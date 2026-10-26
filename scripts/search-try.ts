/**
 * Try the search pipeline from the terminal, against the database in DATABASE_URL (read-only).
 *
 *   npm run search:try -- "rtx 4060" "كارت شاشة" "ryzn 5"
 *   npm run search:try -- --limit 10 "samsung 990"
 *
 * Prints, per query: how it was satisfied (exact / corrected / partial / none), the wording searched when it was
 * corrected, the number of matches and the top results with their category. It runs the same service the website
 * uses, so what you see here is what a shopper gets.
 */
import { config as loadEnv } from "dotenv";
import { getSearchView } from "@/server/services/search.service";

loadEnv({ quiet: true });

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let limit = 5;
  const queries: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i] as string;
    if (a === "--limit") limit = Number(args[++i] ?? "5") || 5;
    else queries.push(a);
  }
  if (queries.length === 0) {
    console.error('Usage: npm run search:try -- [--limit N] "query" ["query" ...]');
    process.exit(1);
  }
  for (const q of queries) {
    const view = await getSearchView({ q });
    const corrected = view.correctedQuery ? `  searched: "${view.correctedQuery}"` : "";
    console.log(`\n"${q}"  [${view.tier}]  ${view.total} match(es)${corrected}`);
    for (const p of view.items.slice(0, limit)) {
      const stock = p.available !== null && p.available <= 0 ? "  (out of stock)" : "";
      console.log(`  - ${p.title.en}${stock}`);
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
