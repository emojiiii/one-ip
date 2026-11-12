import { adaptCoffee, coffeeIpSchema } from './coffee';
import { sameIp } from './ip-address';
import { t } from './locale';
import type { Lookup } from './types';

export async function lookupIp(ip: string, signal: AbortSignal, fresh = false) {
  try {
    const response = await fetch(`https://ip.net.coffee/api/ip/lookup/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
    });
    if (!response.ok) throw new Error(t('api.requestFailed', [response.status]));
    const data = coffeeIpSchema.parse(await response.json());
    if (!sameIp(data.ip, ip)) throw new Error(t('ip.ipReturnedSourceDoesMatchRequestedAddress'));
    return adaptCoffee(data);
  } catch (error) {
    signal.throwIfAborted();
    try {
      const response = await fetch(`/api/ip/lookup/${encodeURIComponent(ip)}${fresh ? '?fresh=1' : ''}`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
        ...(fresh ? { cache: 'no-store' } : {}),
      });
      if (!response.ok) throw new Error(t('api.requestFailed', [response.status]));
      const data: Lookup = await response.json();
      const sources = (data.sources ?? []).filter(source => sameIp(source.ip, ip));
      if (!sources.length) throw new Error(t('home.incompleteLocationInformation'));
      const geo = { ...data.geo, ip };
      const coffee = coffeeIpSchema.parse({
        ip, country: geo.country, countryCode: geo.country_code,
        region: geo.region, city: geo.city, isp: geo.isp,
        asn: typeof geo.asn === 'number' ? geo.asn : undefined,
      });
      return { coffee, geo, sources, rdap: data.rdap, risk: { available: false, reason: t('ip.primarySourceUnavailable') }, fallback: true };
    } catch {
      signal.throwIfAborted();
      throw error;
    }
  }
}
