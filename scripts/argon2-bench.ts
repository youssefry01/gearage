/**
 * Argon2id benchmark: how long does ONE password hash take on THIS machine?
 *
 *   npm run auth:bench                      # the parameters the app uses (64 MiB, t=3, p=1), 15 runs
 *   npm run auth:bench -- --runs 30
 *   npm run auth:bench -- --memory 32768 --time 4 --parallelism 1     # try other parameters (memory in KiB)
 *
 * Also proves the native Argon2 binary for your OS loads (it prints which one). No database and no .env needed. The
 * timing is a property of the machine: run it on the hardware that will serve logins. Target: roughly 100-500 ms per
 * hash. Much faster means the parameters are too weak for that machine; much slower hurts login latency and lets
 * 20 concurrent logins hold about 1.3 GB (64 MiB each) at once.
 */
import { createRequire } from "node:module";
import os from "node:os";
import {
  ARGON2_PARAMS,
  hashPassword,
  verifyPassword,
  type PasswordConfig,
} from "@/server/security/password";

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? Number(process.argv[i + 1]) : fallback;
  if (!Number.isInteger(value) || value < 1)
    throw new Error(`--${name} must be a positive integer`);
  return value;
}

const runs = arg("runs", 15);
const params = {
  memoryKib: arg("memory", ARGON2_PARAMS.memoryKib),
  timeCost: arg("time", ARGON2_PARAMS.timeCost),
  parallelism: arg("parallelism", ARGON2_PARAMS.parallelism),
};
const config: PasswordConfig = {
  peppers: new Map([[1, "benchmark-only-pepper-benchmark-only-pepper"]]),
  currentVersion: 1,
  params,
};

function binding(): string {
  const require = createRequire(import.meta.url);
  const suffixes = [
    `${process.platform}-${process.arch}`,
    `${process.platform}-${process.arch}-gnu`,
    `${process.platform}-${process.arch}-musl`,
    `${process.platform}-${process.arch}-msvc`,
  ];
  for (const s of suffixes) {
    try {
      const name = `@node-rs/argon2-${s}`;
      const pkg = require(`${name}/package.json`) as { version: string };
      return `${name}@${pkg.version}`;
    } catch {
      /* try the next naming */
    }
  }
  return "NOT FOUND (the native binary for this OS/CPU did not install: run `npm ci` again)";
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const p95 = (xs: number[]) =>
  [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil(xs.length * 0.95) - 1)] ?? 0;

async function main() {
  console.log(
    `Node ${process.version} on ${process.platform}/${process.arch}, ${os.cpus().length} CPU threads, ${(os.totalmem() / 2 ** 30).toFixed(1)} GiB RAM`,
  );
  console.log(`Native binding: ${binding()}`);
  console.log(
    `Parameters: memory ${params.memoryKib} KiB (${params.memoryKib / 1024} MiB), time ${params.timeCost}, parallelism ${params.parallelism}`,
  );

  const sample = await hashPassword("a long benchmark passphrase 123", config);
  console.log(`Stored format: ${sample.replace(/\$[^$]+\$[^$]+$/, "$<salt>$<hash>")}`);
  if (!(await verifyPassword("a long benchmark passphrase 123", sample, config)).valid) {
    throw new Error("Self-check failed: a fresh hash did not verify");
  }

  const hashTimes: number[] = [];
  const verifyTimes: number[] = [];
  for (let i = 0; i < runs; i++) {
    let t = performance.now();
    const h = await hashPassword(`benchmark password number ${i}`, config);
    hashTimes.push(performance.now() - t);
    t = performance.now();
    await verifyPassword(`benchmark password number ${i}`, h, config);
    verifyTimes.push(performance.now() - t);
  }
  const fmt = (xs: number[]) =>
    `median ${median(xs).toFixed(0)} ms, p95 ${p95(xs).toFixed(0)} ms, max ${Math.max(...xs).toFixed(0)} ms`;
  console.log(`\nhash   (${runs} runs): ${fmt(hashTimes)}`);
  console.log(`verify (${runs} runs): ${fmt(verifyTimes)}`);
  console.log("\nPlease report the two lines above, the Node line and the native binding line.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
