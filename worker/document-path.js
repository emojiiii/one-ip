import { unlocalizedPath } from "../shared/locales.js";

// Document routes need a client-side fallback; missing static assets must stay 404.
export function documentPath(pathname) {
  const path = unlocalizedPath(pathname);
  if (/^\/(?:_app|assets)(?:\/|$)/.test(path)) return false;
  if (path.split("/").some((part) => part.startsWith("."))) return false;
  if (/^\/(?:_headers|_redirects|_routes\.json|_worker\.js)(?:\/|$)/.test(path)) return false;
  if (/^\/(?:ip|lookup\/ip|query\/ip|network\/ip)\/[^/]+\/?$/.test(path)) return true;
  const name = path.split("/").at(-1);
  return !name.includes(".") || name.endsWith(".html");
}
