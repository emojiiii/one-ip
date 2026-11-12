import { localeForPath as prefixedLocaleForPath, locales, unlocalizedPath } from "../../../../shared/locales.js";

export { locales, unlocalizedPath };

export type Locale = (typeof locales)[number]["id"];
export const defaultLocale = locales[0].id;

export const publicPages = [
  "/", "/ip", "/whois", "/status", "/ping", "/speedtest",
  "/leak/dns", "/leak/webrtc", "/unlock/sites", "/unlock/gpt",
  "/unlock/claude", "/browser/environment", "/browser/fingerprint",
  "/browser/checks", "/browser/privacy", "/terms", "/privacy",
] as const;

export function localeForPath(path: string) {
  return prefixedLocaleForPath(path) ?? locales[0];
}

export function localeFromPath(path: string): Locale {
  return localeForPath(path).id;
}

export function localeDefinition(locale: Locale) {
  return locales.find(({ id }) => id === locale)!;
}

export function localizedPath(path: string, locale: Locale): `/${string}` {
  const { prefix } = localeDefinition(locale);
  const pathname = unlocalizedPath(path);
  return pathname === "/" ? prefix : `${prefix}${pathname}`;
}
