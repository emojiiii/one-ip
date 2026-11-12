export const locales = /** @type {const} */ ([
  { id: "en", prefix: "/en", label: "English", hreflang: "en", dir: "ltr" },
  { id: "zh-CN", prefix: "/zh", label: "简体中文", hreflang: "zh-CN", dir: "ltr" },
  { id: "es-419", prefix: "/es", label: "Español (Latinoamérica)", hreflang: "es", dir: "ltr" },
  { id: "pt-BR", prefix: "/pt-br", label: "Português (Brasil)", hreflang: "pt-BR", dir: "ltr" },
  { id: "fr", prefix: "/fr", label: "Français", hreflang: "fr", dir: "ltr" },
  { id: "de", prefix: "/de", label: "Deutsch", hreflang: "de", dir: "ltr" },
  { id: "ja", prefix: "/ja", label: "日本語", hreflang: "ja", dir: "ltr" },
  { id: "ko", prefix: "/ko", label: "한국어", hreflang: "ko", dir: "ltr" },
  { id: "ar", prefix: "/ar", label: "العربية", hreflang: "ar", dir: "rtl" },
  { id: "hi", prefix: "/hi", label: "हिन्दी", hreflang: "hi", dir: "ltr" },
]);

/** @param {string} pathname */
export function localeForPath(pathname) {
  return locales.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** @param {string} pathname */
export function unlocalizedPath(pathname) {
  const locale = localeForPath(pathname);
  return locale ? pathname.slice(locale.prefix.length) || "/" : pathname;
}
