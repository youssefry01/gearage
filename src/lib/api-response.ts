import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: { code: string; message: string; details?: unknown } };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

const NO_STORE = { "Cache-Control": "no-store" } as const;

export function ok<T>(data: T, init?: { status?: number; headers?: HeadersInit }) {
  return NextResponse.json<ApiSuccess<T>>(
    { ok: true, data },
    { status: init?.status ?? 200, headers: { ...NO_STORE, ...init?.headers } },
  );
}

function failure(e: AppError) {
  const body: ApiFailure = {
    ok: false,
    error: {
      code: e.code,
      message: e.message,
      ...(e.details === undefined ? {} : { details: e.details }),
    },
  };
  return NextResponse.json(body, { status: e.status, headers: NO_STORE });
}

export function fail(error: unknown) {
  if (error instanceof ZodError) {
    return failure(new AppError("VALIDATION_FAILED", "Invalid input", { details: error.issues }));
  }
  if (isAppError(error)) return failure(error);
  logger.error("unhandled_error", { err: error });
  return failure(new AppError("INTERNAL", "Something went wrong"));
}

/** Wrap a route handler so thrown errors become the standard failure envelope. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      return fail(e);
    }
  };
}
