import { normalizeIp } from './ip-address';
import { probe, request, trace } from '../../routes/leak/webrtc/network';
import type { Geo } from './types';

export interface ProbeResult { samples: number[]; median: number | null }
export async function testConnectivity(url: string, signal?: AbortSignal, onProgress?: (result: ProbeResult) => void): Promise<ProbeResult> {
  const samples: number[] = [];
  let failures = 0;
  function snapshot(): ProbeResult {
    const good = samples.filter(ms => ms >= 0).sort((a, b) => a - b);
    const middle = Math.floor(good.length / 2);
    return { samples: [...samples], median: good.length ? Math.round(good.length % 2 ? good[middle] : (good[middle - 1] + good[middle]) / 2) : null };
  }
  onProgress?.(snapshot());
  for (let i = 0; i < 8; i++) {
    signal?.throwIfAborted();
    const latency = await probe(url, signal);
    samples.push(latency);
    failures = latency < 0 ? failures + 1 : 0;
    signal?.throwIfAborted();
    onProgress?.(snapshot());
    if (failures >= 2) break;
  }
  return snapshot();
}

export interface Site { name: string; method: string; domain?: string; url?: string; icon?: string; type?: string; nameKey?: string }
const fallbackUrl = 'https://necaptcha.nosdn.127.net/ab7f4275c1744aa28e0a8f3a1c58c532.png';
export function siteProbeUrl(site: Pick<Site, 'domain' | 'url'>) { return site.domain ? `https://${site.domain}/` : site.url ?? fallbackUrl; }
export async function probeSite(site: Site, signal?: AbortSignal) { return (await probe(siteProbeUrl(site), signal)) >= 0; }
export async function readSiteEgress(site: Site, signal?: AbortSignal): Promise<Geo | undefined> {
  if (site.method === 'unsupported') return;
  try {
    const scoped = signal ? AbortSignal.any([signal, AbortSignal.timeout(3000)]) : AbortSignal.timeout(3000);
    let geo: Geo;
    if (site.method === 'cftrace' && site.domain) geo = await trace(site.domain, scoped);
    else if ((site.method === 'ip-text' || site.method === 'ip-json') && site.url) {
      const ip = site.method === 'ip-json'
        ? (await request<{ ip?: string }>(site.url, { signal: scoped, cache: 'no-store' })).ip
        : (await request<string>(site.url, { signal: scoped, cache: 'no-store' }, 'text')).replace(/<[^>]*>/g, ' ').match(/(?:IP(?:地址)?|ip)[^\d]{0,30}((?:\d{1,3}\.){3}\d{1,3})/i)?.[1];
      const address = normalizeIp(ip);
      if (!address) throw new Error('无法读取出口 IP');
      geo = { ip: address, source: site.name };
    } else {
      const headers = await request<Headers>(site.url ?? fallbackUrl, { method: 'HEAD', cache: 'no-store', signal: scoped }, 'headers');
      const address = normalizeIp(headers.get('cdn-user-ip') ?? headers.get('x-request-ip') ?? headers.get('x-response-cinfo'));
      if (!address) throw new Error('无法读取出口 IP');
      geo = { ip: address, source: site.name };
    }
    return geo;
  } catch (error) {
    if (signal?.aborted) throw error;
  }
}

export async function inspectSite(site: Site, signal?: AbortSignal): Promise<{ geo?: Geo; reachable: boolean }> {
  const geo = await readSiteEgress(site, signal);
  return geo ? { geo, reachable: true } : { reachable: await probeSite(site, signal) };
}
