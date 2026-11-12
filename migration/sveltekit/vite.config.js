import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { locales, localizedPath, publicPages } from "./src/lib/i18n.ts";

export default defineConfig({
  ssr: {
    noExternal: ["@lucide/svelte", "bits-ui", "runed", "svelte-toolbelt"],
  },
  plugins: [
    sveltekit({
      adapter: adapter({
        pages: "../../dist",
        assets: "../../dist",
        fallback: "200.html",
      }),
      version: { pollInterval: 60_000 },
      prerender: {
        entries: [
          "/sitemap.xml",
          "/robots.txt",
          ...publicPages,
          ...locales.flatMap(({ id }) => publicPages.map((path) => localizedPath(path, id))),
        ],
      },
      csp: {
        mode: "hash",
        directives: {
          "default-src": ["self"],
          "script-src": [
            "self",
            "https://challenges.cloudflare.com",
            "https://static.cloudflareinsights.com",
            "https://www.googletagmanager.com/gtag/",
            // Inline scripts injected by the configured Google Tag Gateway.
            "sha256-NwBB+A/we0a6Jdp1VXan4irqgtum3/5deeAurlmrHRg=",
            "sha256-7lGaeduHe5P2drtIOROpfyLP5J4hwT8oBGemz7Se9M4=",
            "https://www.google.com/recaptcha/",
            "https://www.gstatic.com/recaptcha/",
            "https://www.recaptcha.net",
            "https://www.gstatic.cn",
          ],
          "script-src-attr": ["none"],
          "style-src": ["self", "unsafe-inline"],
          "connect-src": ["self", "https:", "data:"],
          "img-src": ["self", "https:", "data:", "blob:"],
          "font-src": ["self", "data:"],
          "frame-src": [
            "self",
            "about:",
            "https://challenges.cloudflare.com",
            "https://www.google.com/recaptcha/",
            "https://recaptcha.google.com/recaptcha/",
            "https://www.recaptcha.net",
          ],
          "worker-src": ["self"],
          "object-src": ["none"],
          "base-uri": ["none"],
          "form-action": ["self"],
        },
      },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: 5137,
    strictPort: true,
    hmr: { clientPort: 8787 },
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
});
