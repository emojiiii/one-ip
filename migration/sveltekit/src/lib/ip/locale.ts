import { messageCatalog } from '../message-catalog';
import type { Locale } from '../i18n';

const catalog = messageCatalog('ip', 'webrtc');
export const { t } = catalog;

export function localizeCatalogItem<T extends { name: string; nameKey?: string; note?: string; noteKey?: string }>(item: T, locale?: Locale) {
  return {
    ...item,
    name: item.nameKey && catalog.has(item.nameKey, locale) ? t(item.nameKey, [], locale) : item.name,
    note: item.noteKey && catalog.has(item.noteKey, locale) ? t(item.noteKey, [], locale) : item.note,
  };
}
