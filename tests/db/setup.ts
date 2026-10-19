// Runs in every DB test worker BEFORE any test code. From here on, the app's own `getDb()` can only reach the test
// database: DATABASE_URL and DIRECT_URL are overwritten with it, and we stop if it is not clearly a `_test` database.
const url = process.env["TEST_DATABASE_URL_RESOLVED"];
if (!url)
  throw new Error("DB tests must be started with `npm run test:db` (global setup did not run).");
const dbName = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
if (!dbName.endsWith("_test"))
  throw new Error(`Refusing to run: "${dbName}" is not a _test database.`);

process.env["DATABASE_URL"] = url;
process.env["DIRECT_URL"] = url;
process.env["DB_POOL_MAX"] = "30"; // the concurrency tests open many connections at once
process.env["LOG_LEVEL"] = "error";
export {};
