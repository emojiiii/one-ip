import { locales, localizedPath } from "./i18n";

export const siteOrigin =
  import.meta.env.VITE_SITE_ORIGIN?.trim() ||
  (import.meta.env.PROD ? "https://ip.kitt.tools" : undefined);

export function pageAlternates(path: string, origin: string) {
  return [
    ...locales.map(({ id, hreflang }) => ({
      hreflang,
      href: new URL(localizedPath(path, id), origin).href,
    })),
    { hreflang: "x-default", href: new URL(path, origin).href },
  ];
}
