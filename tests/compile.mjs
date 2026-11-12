import { buildSync, transformSync } from "esbuild";

export function compile(
  source,
  { format = "esm", loader = "ts", target = "es2022" } = {},
) {
  return transformSync(source, {
    format,
    loader,
    target,
    jsx: loader === "tsx" ? "automatic" : undefined,
    sourcemap: false,
  }).code;
}

export function moduleUrl(source, options) {
  return `data:text/javascript;base64,${Buffer.from(
    compile(source, options),
  ).toString("base64")}`;
}

export function bundledModuleUrl(entryPoint) {
  const result = buildSync({
    entryPoints: [entryPoint],
    inject: ["./tests/i18n-fixture.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node24",
    write: false,
  });
  return `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`;
}
