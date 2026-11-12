import { spawn } from "node:child_process";

const pnpm = process.env.npm_execpath;
const script = pnpm && /\.[cm]?js$/i.test(pnpm);
const command = script ? process.execPath : pnpm || (process.platform === "win32" ? "pnpm.cmd" : "pnpm");
const start = (args) => spawn(command, script ? [pnpm, ...args] : args, {
  stdio: "inherit",
  shell: !pnpm && process.platform === "win32",
});

const children = [
  start(["dev"]),
  start(
    [
      "exec",
      "wrangler",
      "dev",
      "--env",
      "local",
      "--var",
      "LOCAL_DEV:true",
      "--assets",
      "./migration/sveltekit/static",
      "--ip",
      "127.0.0.1",
      "--port",
      "8787",
    ],
  ),
];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill("SIGTERM");
}
for (const child of children) {
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => stop(code ?? 1));
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
