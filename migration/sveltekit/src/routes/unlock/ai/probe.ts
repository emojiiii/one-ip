import type { Locale } from '../../../lib/i18n';
import { parseTrace, request } from '../../leak/webrtc/network';
import { t } from './locale';

export interface AiProbeResult {
  samples: number[];
  median: number | null;
  status: 'response' | 'restricted' | 'unknown';
  description: string;
}

export async function probeAiDomain(domain: string, signal?: AbortSignal, locale?: Locale): Promise<AiProbeResult> {
  const readable = domain === 'claude.ai' || domain === 'www.perplexity.ai';
  const path = readable ? '/cdn-cgi/trace' : domain === 'gemini.google.com' ? '/robots.txt' : '/favicon.ico';
  signal?.throwIfAborted();
  const start = performance.now();
  try {
    const body = await request<string>(`https://${domain}${path}`, {
      mode: readable ? 'cors' : 'no-cors',
      credentials: 'omit',
      cache: 'no-store',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(3000)]) : AbortSignal.timeout(3000),
    }, readable ? 'text' : 'opaque');
    if (readable) parseTrace(body);
  } catch (error) {
    if (signal?.aborted) throw error;
    return { samples: [-1], median: null, status: 'unknown', description: t('ai.validResponseWithinOneSecondProbeLimitSkipped', [], locale) };
  }
  const elapsed = Math.round(performance.now() - start);
  const key = readable
    ? 'ai.readValidatedEdgeNetworkResponseDoesGuaranteeLogin'
    : 'ai.receivedResourceResponseDoesGuaranteeLoginChatAvailability';
  return { samples: [elapsed], median: elapsed, status: 'response', description: t(key, [domain, path], locale) };
}
