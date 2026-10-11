import { ok, handle } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { isValidCronRequest } from "@/server/security/cron-auth";
import { runJobs } from "@/server/jobs/registry";

export const dynamic = "force-dynamic";

// GET because Vercel cron only issues GET (ADR 0007). Auth is a constant-time Bearer CRON_SECRET check.
export const GET = handle(async (request: Request) => {
  if (!isValidCronRequest(request.headers.get("authorization"), getEnv().CRON_SECRET)) {
    throw new AppError("UNAUTHENTICATED", "Invalid cron credentials");
  }
  return ok({ cadence: "tick", results: await runJobs("tick") });
});
