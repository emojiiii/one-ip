import { activeLocale, messageCatalog } from '../../../lib/message-catalog';

export const { t } = messageCatalog('webrtc');

export async function localizeApiMessage(message: string, locale = activeLocale()) {
  if (locale === 'zh-CN') return message;
  const { default: zh } = await import('../../../i18n/zh-CN/webrtc.json');
  const entry = Object.entries(zh).find(([key, value]) => key.startsWith('api.') && value === message);
  return entry ? t(entry[0], [], locale) : message;
}
