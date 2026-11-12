import { endpoint } from '../leak/webrtc/network';
import { t } from './locale';

type Provider = { id: 'turnstile' | 'turnstile-noninteractive'; configured: boolean; sitekey?: string };
type WidgetApi = { render(host: HTMLElement, options: Record<string, unknown>): string | number; reset(id: string | number): void; remove?(id: string | number): void };
declare global { interface Window { turnstile?: WidgetApi } }

let scriptPromise: Promise<WidgetApi> | undefined;
function loadWidget() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<WidgetApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    const timeout = setTimeout(fail, 15000);
    function fail() { clearTimeout(timeout); script.remove(); scriptPromise = undefined; reject(new Error(t('api.verificationServiceUnavailablePleaseRetryLater'))); }
    script.onerror = fail;
    script.onload = () => { if (!window.turnstile?.render) return fail(); clearTimeout(timeout); resolve(window.turnstile); };
    document.head.append(script);
  });
  return scriptPromise;
}

export async function getPingVerification(signal: AbortSignal) {
  signal.throwIfAborted();
  const providers = (await endpoint<Provider[]>('/browser/challenges', { signal })).filter(p => p.configured && p.sitekey);
  const provider = providers.find(p => p.id === 'turnstile') ?? providers[0];
  if (!provider?.sitekey) throw new Error(t('api.verificationServiceConfiguredSite'));
  const api = await new Promise<WidgetApi>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    loadWidget().then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    if (signal.aborted) abort();
  });
  signal.throwIfAborted();
  return new Promise<{ provider: Provider['id']; token: string }>((resolve, reject) => {
    const dialog = document.createElement('dialog');
    const title = document.createElement('h2'); title.textContent = t('common.humanVerification');
    const description = document.createElement('p'); description.textContent = t('ping.verifyBeforeMeasurement');
    const host = document.createElement('div');
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = t('common.cancel');
    dialog.append(title, description, host, cancel); document.body.append(dialog);
    let widget: string | number | undefined;
    let settled = false;
    const finish = (token?: string, error?: unknown) => {
      if (settled) return; settled = true; clearTimeout(timeout); signal.removeEventListener('abort', abort);
      if (widget !== undefined) { if (api.remove) api.remove(widget); else api.reset(widget); }
      dialog.remove();
      if (token) resolve({ provider: provider.id, token }); else reject(error);
    };
    const abort = () => finish(undefined, signal.reason);
    const cancelVerification = () => finish(undefined, new DOMException(t('common.cancelled'), 'AbortError'));
    const timeout = setTimeout(() => finish(undefined, new Error(t('api.verificationServiceUnavailablePleaseRetryLater'))), 120000);
    signal.addEventListener('abort', abort, { once: true });
    cancel.onclick = cancelVerification;
    dialog.addEventListener('cancel', event => { event.preventDefault(); cancelVerification(); });
    dialog.showModal();
    try {
      widget = api.render(host, { sitekey: provider.sitekey, action: 'ping_start', size: 'flexible', retry: 'never', 'refresh-expired': 'manual', 'refresh-timeout': 'manual', callback: (token: string) => finish(token), 'error-callback': () => finish(undefined, new Error(t('api.verificationServiceUnavailablePleaseRetryLater'))), 'expired-callback': () => finish(undefined, new Error(t('api.verificationFailedTokenExpiredPleaseVerifyAgain'))), 'timeout-callback': () => finish(undefined, new Error(t('api.verificationServiceUnavailablePleaseRetryLater'))) });
    } catch (error) { finish(undefined, error); }
    if (signal.aborted) abort();
  });
}
