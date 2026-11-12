import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const target = process.argv[2];
if (target !== "docker") throw new Error("Expected deployment target: docker");

await build({
  absWorkingDir: fileURLToPath(root),
  entryPoints: ["server/index.mjs"],
  outfile: ".output/server.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2023",
  external: ["node:*"],
});
