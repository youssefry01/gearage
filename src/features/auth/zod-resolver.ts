import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";

/**
 * A small react-hook-form resolver for a Zod schema (instead of adding @hookform/resolvers, which pulls in an extra
 * `effect` copy; HANDOFF "keep the lockfile"). Error messages are the codes defined in `domain/auth.ts`; the field
 * components translate them. Values go to the server as typed; the SERVER schema is the authority.
 */
export function zodResolver<S extends z.ZodType<FieldValues, FieldValues>>(
  schema: S,
): Resolver<z.input<S>> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) return { values: values as z.input<S>, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const name = issue.path.join(".");
      if (name && !errors[name]) errors[name] = { type: issue.code, message: issue.message };
    }
    return { values: {}, errors: errors as FieldErrors<z.input<S>> };
  };
}
