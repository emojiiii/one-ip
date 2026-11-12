import type { Locale } from "./i18n";
import { registerLocale, type Messages } from "./message-catalog";

const modules = import.meta.glob<{ resources: Record<string, Messages> }>("../i18n/*/catalog.ts");
const loading = new Map<Locale, Promise<void>>();

export function loadLocale(locale: Locale) {
  let pending = loading.get(locale);
  if (!pending) {
    const load = modules[`../i18n/${locale}/catalog.ts`];
    if (!load) throw new Error(`Missing translation catalog: ${locale}`);
    pending = load().then(({ resources }) => {
      const catalog = Object.fromEntries(Object.entries(resources).map(([path, messages]) => [
        path.slice(2, -5),
        messages,
      ]));
      registerLocale(locale, catalog);
    });
    loading.set(locale, pending);
  }
  return pending;
}
