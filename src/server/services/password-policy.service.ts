import { checkPasswordShape, type PasswordIssue } from "@/domain/password";
import { checkBreached } from "@/server/security/hibp";

export type PasswordAssessment =
  | { ok: true; breachCheck: "checked" | "skipped" }
  | { ok: false; issue: PasswordIssue | "breached" };

/**
 * The full password policy (ADR 0003): 12 to 128 characters after NFKC normalization, no composition rules, and NOT
 * present in any known breach. The breach check fails open (`breachCheck: "skipped"`) when the service is
 * unreachable. Length is checked first, so an obviously invalid password never costs a network call.
 */
export async function assessPassword(
  password: string,
  deps: { checkBreached?: typeof checkBreached } = {},
): Promise<PasswordAssessment> {
  const shape = checkPasswordShape(password);
  if (shape) return { ok: false, issue: shape };
  const result = await (deps.checkBreached ?? checkBreached)(password);
  if (result.status === "unknown") return { ok: true, breachCheck: "skipped" };
  if (result.count > 0) return { ok: false, issue: "breached" };
  return { ok: true, breachCheck: "checked" };
}
