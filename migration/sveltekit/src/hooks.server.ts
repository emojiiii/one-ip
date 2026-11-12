import type { Handle } from "@sveltejs/kit/hooks";
import { localeForPath } from "./lib/i18n";

export const handle: Handle = ({ event, resolve }) => {
  const { id, dir } = localeForPath(event.url.pathname);
  return resolve(event, {
    transformPageChunk: ({ html }) => html.replace('<html lang="en" dir="ltr">', `<html lang="${id}" dir="${dir}">`),
  });
};
