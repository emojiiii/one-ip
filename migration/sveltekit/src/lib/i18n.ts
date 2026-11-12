import { localeForPath as prefixedLocaleForPath, locales, unlocalizedPath } from "../../../../shared/locales.js";

export { locales, unlocalizedPath };

export type Locale = (typeof locales)[number]["id"];
export const defaultLocale = "zh-CN" satisfies Locale;
const defaultLocaleDefinition = localeDefinition(defaultLocale);

export const publicPages = [
  "/", "/ip", "/ip/batch", "/dns-records", "/whois", "/status", "/ping", "/speedtest",
  "/leak/dns", "/leak/webrtc", "/unlock/sites", "/unlock/gpt",
  "/unlock/claude", "/browser/environment", "/browser/fingerprint",
  "/browser/checks", "/browser/privacy", "/terms", "/privacy",
] as const;

export function localeForPath(path: string) {
  return prefixedLocaleForPath(path) ?? defaultLocaleDefinition;
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
