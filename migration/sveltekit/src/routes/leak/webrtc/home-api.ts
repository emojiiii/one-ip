import { t } from "./locale";
import { normalizeIp, sameIp } from "./ip-address";
import { endpoint, request } from "./network";
import type { Geo } from "./types";

export const getMyIp = (signal?: AbortSignal) =>
  endpoint<Geo>("/me", { signal });
/** Location for an IP: browser-direct providers first, then the same-origin API. */
export async function getGeo(
  ip: string,
  signal?: AbortSignal,
  timeoutMs = 3000,
): Promise<Geo> {
  // Each provider gets its own budget so one blocked host (common from
  // mainland China) cannot starve the others.
  const scoped = () => {
    const timeout = AbortSignal.timeout(timeoutMs);
    return signal ? AbortSignal.any([signal, timeout]) : timeout;
  };
  try {
    return await Promise.any([
      geoFromIpQuery(ip, scoped()),
      geoFromIpWhoIs(ip, scoped()),
    ]);
  } catch {
    signal?.throwIfAborted();
  }
  try {
    const data = await endpoint<Geo>(`/geoip/${encodeURIComponent(ip)}`, {
      signal: scoped(),
    });
    if (!sameIp(data?.ip, ip) || (!data.country && !data.isp))
      throw new Error(t("home.incompleteLocationInformation"));
    return { ...data, ip };
  } catch {
    signal?.throwIfAborted();
    throw new Error(t("home.locationDetailsAreUnavailablePleaseRetryLater"));
  }
}
async function geoFromIpQuery(ip: string, signal: AbortSignal): Promise<Geo> {
  // api.ip.sb/geoip is blocked for third-party sites by AdGuard Tracking
  // Protection, so the browser uses ipquery.io instead.
  const data = await request<{
    ip?: string;
    isp?: { asn?: string; org?: string; isp?: string };
    location?: {
      country?: string;
      country_code?: string;
      state?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
      timezone?: string;
    };
  }>(`https://api.ipquery.io/${encodeURIComponent(ip)}?format=json`, {
    signal,
  });
  const location = data?.location;
  const isp = data?.isp?.isp || data?.isp?.org;
  if (!sameIp(data?.ip, ip) || (!location?.country && !isp))
    throw new Error(t("home.incompleteLocationInformation"));
  const asn = Number(data.isp?.asn?.replace(/^AS/i, ""));
  return {
    ip,
    country: location?.country,
    country_code: location?.country_code,
    region: location?.state,
    city: location?.city,
    isp,
    asn: Number.isFinite(asn) && asn > 0 ? asn : undefined,
    latitude: location?.latitude,
    longitude: location?.longitude,
    timezone: location?.timezone,
    source: "ipquery.io",
  };
}
async function geoFromIpWhoIs(ip: string, signal: AbortSignal): Promise<Geo> {
  const data = await request<{
    ip?: string;
    success: boolean;
    country?: string;
    country_code?: string;
    region?: string;
    city?: string;
    connection?: { isp?: string; asn?: number };
    latitude?: number;
    longitude?: number;
    timezone?: { id?: string };
  }>(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal });
  if (data?.success !== true || !sameIp(data.ip, ip))
    throw new Error(t("home.locationDetailsAreUnavailablePleaseRetryLater"));
  return {
    ip,
    country: data.country,
    country_code: data.country_code,
    region: data.region,
    city: data.city,
    isp: data.connection?.isp,
    asn: data.connection?.asn,
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone?.id,
    source: "ipwho.is",
  };
}
export async function getBrowserIp(
  version: 4 | 6,
  signal?: AbortSignal,
): Promise<Geo> {
  const data = await request<{ ip: string }>(
    `https://${version === 4 ? "api4" : "api6"}.ipify.org?format=json`,
    {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(3000)])
        : AbortSignal.timeout(3000),
      cache: "no-store",
    },
  );
  const ip = normalizeIp(data?.ip);
  if (!ip || (version === 6) !== ip.includes(":"))
    throw new Error(t("home.noValidIpObtained"));
  return { ip, source: "ipify" };
}
