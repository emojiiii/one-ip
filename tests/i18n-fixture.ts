import { readFileSync, readdirSync } from "node:fs";
import { registerLocale } from "../migration/sveltekit/src/lib/message-catalog";

// The isolated esbuild tests run without the SvelteKit layout loader.
for (const locale of ["en", "zh-CN"] as const) {
  const directory = `migration/sveltekit/src/i18n/${locale}`;
  const catalogs = Object.fromEntries(readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .map((file) => [file.slice(0, -5), JSON.parse(readFileSync(`${directory}/${file}`, "utf8"))]));
  registerLocale(locale, catalogs);
}
