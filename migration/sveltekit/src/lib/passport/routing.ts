import { getDomesticIp } from '../ip/home';
import { normalizeIp, sameIp } from '../ip/ip-address';
import { readSiteEgress } from '../ip/connectivity';
import { runProbeBatch } from '../ip/probe-batch';
import { getBrowserIp, getGeo } from '../../routes/leak/webrtc/home-api';
import { trace } from '../../routes/leak/webrtc/network';
import sites from '../../routes/unlock/sites/egress-sites.json';
import type { Geo } from '../ip/types';

export type RouteKind = 'domestic' | 'overseas' | 'both' | 'other' | 'unknown';
export type SiteStatus = 'observed' | 'unavailable' | 'unsupported' | 'not-attempted';
export interface RoutingSummary {
  domestic: { status: 'observed' | 'unavailable'; country?: string; countryCode?: string };
  overseas: { status: 'observed' | 'unavailable'; country?: string; countryCode?: string };
  comparison: 'same' | 'different' | 'unknown';
  sites: {
    total: number;
    attempted: number;
    observed: number;
    unavailable: number;
    unsupported: number;
    notAttempted: number;
    ipv4Observed: number;
    ipv6Observed: number;
    ipv4Exits: number;
    ipv6Exits: number;
    domesticMatches: number;
    overseasMatches: number;
    bothMatches: number;
    otherMatches: number;
    unclassified: number;
    details: Array<{ name: string; type: 'domestic' | 'international'; status: SiteStatus; route: RouteKind; family?: 4 | 6 }>;
  };
}

type RawSite = { name: string; type: 'domestic' | 'international'; status: SiteStatus; ip?: string };
const selectedNames = ['Telegram', 'IP.cn', '网易', '字节跳动', 'Cloudflare中国', 'IP.SB', 'chatgpt.com', 'x.com', 'cloudflare.com'];
const selectedSites = selectedNames.map((name) => {
  const site = sites.find((item) => item.name === name);
  if (!site) throw new Error(`Missing egress site: ${name}`);
  return site;
});

/** Only aggregates leave this function; raw addresses are not returned. */
export function summarizeRouting(domestic: Geo | undefined, overseas: Geo | undefined, raw: RawSite[]): RoutingSummary {
  const domesticIp = normalizeIp(domestic?.ip);
  const overseasIp = normalizeIp(overseas?.ip);
  const comparable = Boolean(domesticIp && overseasIp && !domesticIp.includes(':') && !overseasIp.includes(':'));
  const comparison = comparable ? (sameIp(domesticIp, overseasIp) ? 'same' : 'different') : 'unknown';
  const ipv4 = new Set<string>();
  const ipv6 = new Set<string>();
  let ipv4Observed = 0;
  let ipv6Observed = 0;
  const details = raw.map(({ name, type, status, ip }) => {
    const address = status === 'observed' ? normalizeIp(ip) : null;
    const family: 4 | 6 | undefined = address ? (address.includes(':') ? 6 : 4) : undefined;
    let route: RouteKind = 'unknown';
    if (address && family === 4) {
      ipv4.add(address);
      ipv4Observed++;
      if (comparable) {
        const matchesDomestic = sameIp(address, domesticIp);
        const matchesOverseas = sameIp(address, overseasIp);
        route = matchesDomestic && matchesOverseas ? 'both' : matchesDomestic ? 'domestic' : matchesOverseas ? 'overseas' : 'other';
      }
    } else if (address && family === 6) {
      ipv6.add(address);
      ipv6Observed++;
    }
    return { name, type, status, route, ...(family ? { family } : {}) };
  });
  const count = (status: SiteStatus) => details.filter((item) => item.status === status).length;
  const routeCount = (route: RouteKind) => details.filter((item) => item.status === 'observed' && item.route === route).length;
  const observed = count('observed');
  const unavailable = count('unavailable');
  return {
    domestic: domesticIp ? { status: 'observed', country: domestic?.country, countryCode: domestic?.country_code } : { status: 'unavailable' },
    overseas: overseasIp ? { status: 'observed', country: overseas?.country, countryCode: overseas?.country_code } : { status: 'unavailable' },
    comparison,
    sites: {
      total: details.length, attempted: observed + unavailable, observed, unavailable,
      unsupported: count('unsupported'), notAttempted: count('not-attempted'),
      ipv4Observed, ipv6Observed, ipv4Exits: ipv4.size, ipv6Exits: ipv6.size,
      domesticMatches: routeCount('domestic'), overseasMatches: routeCount('overseas'),
      bothMatches: routeCount('both'), otherMatches: routeCount('other'), unclassified: routeCount('unknown'), details,
    },
  };
}

async function overseasExit(signal: AbortSignal): Promise<Geo> {
  try {
    return await getBrowserIp(4, signal);
  } catch {
    signal.throwIfAborted();
  }
  return Promise.any(['chatgpt.com', 'www.cloudflare.com', '1.1.1.1'].map(async (host) => {
    const result = await trace(host, signal);
    if (result.ip.includes(':')) throw new Error('Expected IPv4');
    return result;
  }));
}

/** Collect a bounded sample using the same browser probes as the home page. */
export async function collectRouting(signal: AbortSignal): Promise<RoutingSummary> {
  signal.throwIfAborted();
  const scoped = AbortSignal.any([signal, AbortSignal.timeout(9000)]);
  const raw: RawSite[] = selectedSites.map((site) => ({
    name: site.name,
    type: site.type as 'domestic' | 'international',
    status: site.method === 'unsupported' ? 'unsupported' : 'not-attempted',
  }));
  let domestic: Geo | undefined;
  let overseas: Geo | undefined;
  const reference = async (which: 'domestic' | 'overseas') => {
    let exit: Geo;
    try {
      exit = await (which === 'domestic' ? getDomesticIp(scoped) : overseasExit(scoped));
    } catch {
      signal.throwIfAborted();
      return;
    }
    if (which === 'domestic') domestic = exit;
    else overseas = exit;
    try {
      const location = await getGeo(exit.ip, scoped);
      if (which === 'domestic') domestic = { ...exit, ...location, ip: exit.ip };
      else overseas = { ...exit, ...location, ip: exit.ip };
    } catch {
      signal.throwIfAborted();
    }
  };
  await Promise.all([
    reference('domestic'),
    reference('overseas'),
    runProbeBatch(selectedSites.map((site, index) => ({ site, index })).filter(({ site }) => site.method !== 'unsupported'), 4, scoped, async ({ site, index }) => {
      raw[index].status = 'unavailable';
      try {
        const result = await readSiteEgress(site, scoped);
        if (result && normalizeIp(result.ip)) {
          raw[index].status = 'observed';
          raw[index].ip = result.ip;
        }
      } catch {
        signal.throwIfAborted();
      }
    }),
  ]);
  signal.throwIfAborted();
  return summarizeRouting(domestic, overseas, raw);
}
