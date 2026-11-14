import { defaultLocale, locales, localizedPath, type Locale } from "./i18n";

export const siteOrigin =
  import.meta.env.VITE_SITE_ORIGIN?.trim() ||
  (import.meta.env.PROD ? "https://ip.kitt.tools" : undefined);

export function canonicalPath(path: string, locale: Locale) {
  return path === "/" && locale === defaultLocale ? "/" : localizedPath(path, locale);
}

export function pageAlternates(path: string, origin: string) {
  return [
    ...locales.map(({ id, hreflang }) => ({
      hreflang,
      href: new URL(canonicalPath(path, id), origin).href,
    })),
    { hreflang: "x-default", href: new URL(path, origin).href },
  ];
}
