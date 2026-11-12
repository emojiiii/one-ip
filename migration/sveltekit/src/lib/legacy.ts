import { localeFromPath, localizedPath, unlocalizedPath } from './i18n';

const redirects: Record<string, string> = {
  '/lookup': '/ip', '/lookup/ip': '/ip', '/lookup/whois': '/whois',
  '/query': '/ip', '/query/ip': '/ip', '/query/whois': '/whois',
  '/network': '/unlock/sites', '/network/ip': '/ip', '/network/whois': '/whois',
  '/network/connectivity': '/unlock/sites', '/network/link': '/unlock/sites', '/network/exits': '/unlock/sites',
  '/network/dns': '/leak/dns', '/network/speedtest': '/speedtest', '/network/ping': '/ping',
  '/connectivity': '/unlock/sites', '/link': '/unlock/sites', '/dns': '/leak/dns',
  '/webrtc': '/leak/webrtc', '/network/webrtc': '/leak/webrtc', '/browser/webrtc': '/leak/webrtc',
  '/browser/consistency': '/browser/checks', '/browser/automation': '/browser/checks',
  '/ai': '/unlock/gpt', '/ai/gpt': '/unlock/gpt', '/ai/claude': '/unlock/claude',
  '/gpt': '/unlock/gpt', '/claude': '/unlock/claude', '/ai/status': '/status',
  '/ai/status/openai': '/status?service=9', '/ai/status/claude': '/status?service=4',
  '/ai/gpt/status': '/status?service=9', '/ai/claude/status': '/status?service=4',
  '/status/openai': '/status?service=9', '/status/claude': '/status?service=4',
  '/gpt/status.html': '/status?service=9', '/claude/status.html': '/status?service=4',
  '/leak': '/leak/dns', '/unlock': '/unlock/sites', '/browser': '/browser/environment'
};

export function legacyDestination(url: URL): string | undefined {
  const path = unlocalizedPath(url.pathname).replace(/\/+$/, '') || '/';
  const ip = path.match(/^\/(?:lookup|query|network)\/ip\/([^/]+)$/);
  const target = ip ? `/ip/${ip[1]}` : redirects[path];
  if (!target) return undefined;
  const [pathname, search] = target.split('?');
  return localizedPath(pathname, localeFromPath(url.pathname)) + (search ? `?${search}` : url.search) + url.hash;
}
