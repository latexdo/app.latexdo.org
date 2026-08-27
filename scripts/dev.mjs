import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const tmpRoot = path.join(os.tmpdir(), "app-latexdo-org-wrangler");

process.env.WRANGLER_CACHE_DIR ??= path.join(tmpRoot, "wrangler-cache");
process.env.MINIFLARE_CACHE_DIR ??= path.join(tmpRoot, "miniflare-cache");
process.env.CLOUDFLARE_CF_FETCH_PATH ??= path.join(tmpRoot, "cf.json");

function hasOption(optionName) {
  return args.some((arg) => arg === optionName || arg.startsWith(`${optionName}=`));
}

async function isPortOpen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function findOpenPort(startPort) {
  for (let port = startPort; port < startPort + 100; port += 1) {
    if (await isPortOpen(port)) return port;
  }
  throw new Error(`No open local port found from ${startPort} to ${startPort + 99}.`);
}

const forwardedArgs = [...args];

if (!hasOption("--persist-to")) {
  forwardedArgs.push("--persist-to", path.join(tmpRoot, "state"));
}

if (!hasOption("--port")) {
  forwardedArgs.push("--port", String(await findOpenPort(8787)));
}

const wranglerCommand = process.platform === "win32" ? "wrangler.cmd" : "wrangler";
const child = spawn(wranglerCommand, ["dev", ...forwardedArgs], {
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
