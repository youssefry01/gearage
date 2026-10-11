import { NextResponse } from "next/server";
import { ok, handle } from "@/lib/api-response";
import { checkReadiness } from "@/server/services/health.service";

export const dynamic = "force-dynamic";

/** Readiness: 200 when the DB answers, 503 otherwise. */
export const GET = handle(async () => {
  const report = await checkReadiness();
  if (report.db === "down") {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL", message: "Database unavailable" }, data: report },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return ok(report);
});
