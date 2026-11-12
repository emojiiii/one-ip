import { siteOrigin } from "../../lib/seo";
import type { RequestHandler } from "./$types";

export const prerender = true;

export const GET: RequestHandler = ({ url }) => {
  const sitemap = new URL("/sitemap.xml", siteOrigin ?? url.origin).href;
  return new Response(`User-agent: *\nDisallow: /api/\n\nSitemap: ${sitemap}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
