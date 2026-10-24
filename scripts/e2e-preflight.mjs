// Fails fast, with a clear message, when the e2e port is already taken (instead of Playwright attaching to a stale or
// unrelated server and reporting confusing "connection refused" / wrong-page failures).
// Skipped when E2E_REUSE_SERVER=1 (you chose to reuse a running server on purpose).
import net from "node:net";

const port = Number(process.env.PORT ?? 3000);

if (process.env.E2E_REUSE_SERVER === "1") {
  console.log(`e2e preflight: E2E_REUSE_SERVER=1, reusing whatever serves port ${port}.`);
  process.exit(0);
}

/** Try to bind the port on both IPv4 and IPv6; EADDRINUSE on either means something is listening. */
const busy = (host) =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (error) => resolve(error.code === "EADDRINUSE"));
    server.once("listening", () => server.close(() => resolve(false)));
    server.listen({ port, host, exclusive: true });
  });

const inUse = (await busy("0.0.0.0")) || (await busy("::"));

if (inUse) {
  console.error(`
e2e preflight FAILED: port ${port} is already in use.

  Something (often a leftover \`npm run dev\` or \`npm run start\`) is listening there, and the e2e run would test
  that server instead of a fresh one. Pick one:
    - stop it, then run again; or
    - use another port:   PORT=3100 npm run test:e2e   (PowerShell: $env:PORT=3100; npm run test:e2e); or
    - reuse it on purpose: E2E_REUSE_SERVER=1 npm run test:e2e
`);
  process.exit(1);
}
console.log(`e2e preflight: port ${port} is free.`);
