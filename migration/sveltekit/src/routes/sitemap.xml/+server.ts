import { publicPages } from "../../lib/i18n";
import { pageAlternates, siteOrigin } from "../../lib/seo";
import type { RequestHandler } from "./$types";

export const prerender = true;

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
}

export const GET: RequestHandler = ({ url }) => {
  const origin = siteOrigin ?? url.origin;
  const entries = publicPages.flatMap((path) => {
    const alternates = pageAlternates(path, origin);
    const links = alternates.map(({ hreflang, href }) =>
      `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(href)}" />`,
    ).join("\n");
    return alternates.filter(({ hreflang }) => hreflang !== "x-default").map(({ href }) =>
      `  <url>\n    <loc>${escapeXml(href)}</loc>\n${links}\n  </url>`,
    );
  });
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
