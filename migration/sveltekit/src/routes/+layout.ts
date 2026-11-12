import type { LayoutLoad } from "./$types";
import { localeFromPath } from "../lib/i18n";
import { loadLocale } from "../lib/load-locale";

export const prerender = true;

export const load: LayoutLoad = async ({ url }) => {
  await loadLocale(localeFromPath(url.pathname));
};
