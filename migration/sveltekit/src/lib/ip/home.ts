import { request } from '../../routes/leak/webrtc/network';
import type { Geo } from './types';

export function homeExitCards(domestic: Geo | undefined, overseas: Geo | null | undefined, domesticPending: boolean, overseasPending: boolean, labels: { domestic: string; overseas: string }) {
  return [
    { label: labels.domestic, geo: domestic, busy: domesticPending },
    { label: `${labels.overseas} IPv4`, geo: overseas ?? undefined, busy: overseasPending }
  ].filter(card => card.geo || card.busy);
}

export async function getDomesticIp(signal?: AbortSignal): Promise<Geo> {
  const timeout = AbortSignal.timeout(3000);
  const scoped = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const sources = [
    { url: 'https://necaptcha.nosdn.127.net/ab7f4275c1744aa28e0a8f3a1c58c532.png', header: 'cdn-user-ip' },
    { url: 'https://perfops.byte-test.com/500b-bench.jpg', header: 'x-request-ip' }
  ];
  for (const source of sources) {
    scoped.throwIfAborted();
    try {
      const headers = await request<Headers>(source.url, { method: 'HEAD', mode: 'cors', credentials: 'omit', redirect: 'error', cache: 'no-store', signal: scoped }, 'headers');
      const ip = headers.get(source.header)?.trim();
      if (ip && /^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip) && ip.split('.').every(part => Number(part) <= 255))
        return { ip, source: new URL(source.url).hostname };
    } catch (error) { if (scoped.aborted) throw error; }
  }
  throw new Error('无法获取国内出口 IP');
}
