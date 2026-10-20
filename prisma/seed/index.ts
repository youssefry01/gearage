import "dotenv/config";
import { resolve } from "node:path";
import { LocalStorageProvider } from "@/server/storage/local";
import { assertLocalDatabaseForSeed } from "../guard";
import { changesIn, runSeed } from "./run";

// `tsx prisma/seed/index.ts` bypasses the Prisma CLI guard, so check here before anything else. Refuses non-local hosts.
assertLocalDatabaseForSeed();

const provider = process.env.STORAGE_PROVIDER ?? "local";
if (provider !== "local") {
  console.error(
    `seed: placeholder images are written to local storage only (STORAGE_PROVIDER is "${provider}"). Use STORAGE_PROVIDER=local for seeding.`,
  );
  process.exit(1);
}
const storage = new LocalStorageProvider(
  resolve(process.env.STORAGE_LOCAL_DIR ?? "public/uploads"),
  process.env.STORAGE_PUBLIC_BASE_URL ?? "/uploads",
  { allowSvg: true }, // only our own generated placeholders are ever SVG (admin uploads still refuse it)
);

async function main(): Promise<void> {
  try {
    const report = await runSeed({ storage });
    console.log(
      `seed: ${changesIn(report) === 0 ? "already up to date, nothing changed" : "done"} (${report.assetsWritten} placeholder images written)`,
    );
    for (const [entity, c] of Object.entries(report.entities))
      console.log(
        `  ${entity.padEnd(16)} created ${String(c.created).padStart(3)}  updated ${String(c.updated).padStart(3)}  unchanged ${String(c.unchanged).padStart(3)}`,
      );
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

void main();
