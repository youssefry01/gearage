/**
 * Password peppers by version (ADR 0003). Version 1 is `PASSWORD_PEPPER`; version N >= 2 is `PASSWORD_PEPPER_<N>`.
 * `PASSWORD_PEPPER_CURRENT` (default 1) is the version used for NEW hashes. Every version that any stored hash still
 * uses must stay configured, or those users cannot sign in (they would have to reset their password).
 */
export const PEPPER_MIN_LENGTH = 32;

export type Peppers = { current: number; byVersion: ReadonlyMap<number, string> };

export function loadPeppers(source: Record<string, string | undefined>): Peppers {
  const byVersion = new Map<number, string>();
  const problems: string[] = [];
  for (const [key, value] of Object.entries(source)) {
    const match = /^PASSWORD_PEPPER(?:_(\d+))?$/.exec(key);
    if (!match || value === undefined || value === "") continue;
    const version = match[1] === undefined ? 1 : Number(match[1]);
    if (version < 1 || version > 9999 || (match[1] !== undefined && match[1].startsWith("0"))) {
      problems.push(`${key}: the version must be a positive integer without leading zeros`);
      continue;
    }
    if (version === 1 && match[1] !== undefined) {
      problems.push(`${key}: version 1 is PASSWORD_PEPPER`);
      continue;
    }
    if (value.length < PEPPER_MIN_LENGTH)
      problems.push(`${key}: must be at least ${PEPPER_MIN_LENGTH} characters`);
    byVersion.set(version, value);
  }
  const rawCurrent = source.PASSWORD_PEPPER_CURRENT;
  const current = rawCurrent === undefined || rawCurrent === "" ? 1 : Number(rawCurrent);
  if (!Number.isInteger(current) || current < 1)
    problems.push("PASSWORD_PEPPER_CURRENT: must be a positive integer");
  else if (!byVersion.has(current))
    problems.push(
      current === 1
        ? "PASSWORD_PEPPER: required"
        : `PASSWORD_PEPPER_CURRENT is ${current} but PASSWORD_PEPPER_${current} is not set`,
    );
  if (problems.length > 0)
    throw new Error(`Invalid password pepper configuration:\n  - ${problems.join("\n  - ")}`);
  return { current, byVersion };
}
