import type { Handle } from "@sveltejs/kit/hooks";
import { defaultLocale, localeForPath } from "./lib/i18n";

export const handle: Handle = ({ event, resolve }) => {
  const { id, dir } = localeForPath(event.url.pathname);
  return resolve(event, {
    transformPageChunk: ({ html }) => html.replace(
      `<html lang="${defaultLocale}" dir="ltr">`,
      `<html lang="${id}" dir="${dir}">`,
    ),
  });
};
