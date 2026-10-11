import { assertLocalDatabaseForSeed } from "../guard";

assertLocalDatabaseForSeed();

// Catalog seed arrives in M2b. Intentionally a no-op so `prisma db seed` is wired and safe to run.
console.log("seed: nothing to seed yet (catalog seed ships in M2b)");
