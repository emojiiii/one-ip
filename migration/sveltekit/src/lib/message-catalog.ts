import { createInstance, type i18n } from "i18next";
import { defaultLocale, localeFromPath, type Locale } from "./i18n";

export type Messages = Readonly<Record<string, string>>;
export type LocaleCatalog = Record<string, Messages>;

const instances = new Map<Locale, i18n>();

export function activeLocale(): Locale {
  return typeof window === "undefined" ? defaultLocale : localeFromPath(window.location.pathname);
}

export function registerLocale(locale: Locale, catalog: LocaleCatalog) {
  const instance = createInstance();
  void instance.init({
    lng: locale,
    fallbackLng: false,
    load: "currentOnly",
    initAsync: false,
    keySeparator: false,
    nsSeparator: false,
    resources: { [locale]: catalog },
    interpolation: { prefix: "{", suffix: "}", escapeValue: false },
    parseMissingKeyHandler: (key) => {
      throw new Error(`Missing ${locale} translation: ${key}`);
    },
  });
  instances.set(locale, instance);
}

function instanceFor(locale: Locale) {
  const instance = instances.get(locale);
  if (!instance) throw new Error(`Translation catalog has not loaded: ${locale}`);
  return instance;
}

export function messageCatalog(...namespaces: string[]) {
  function t(key: string, values: readonly unknown[] = [], locale = activeLocale()) {
    const replace = Object.fromEntries(values.map((value, index) => [index, String(value)]));
    return instanceFor(locale).t(key, { ns: namespaces, replace, nest: false });
  }

  function has(key: string, locale = activeLocale()) {
    return instanceFor(locale).exists(key, { ns: namespaces });
  }

  return { t, has };
}
