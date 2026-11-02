import { hash, verify } from "@node-rs/argon2";
import {
  needsRehash,
  formatStoredHash,
  parseStoredHash,
  type Argon2Params,
} from "@/domain/password-hash";
import { normalizePassword } from "@/domain/password";
import { getEnv, loadPeppers } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Argon2id parameters (ADR 0003): 64 MiB, 3 passes, 1 lane, 32-byte output, random 16-byte salt per hash.
 * OWASP's floor is 19 MiB / t=2 / p=1; we never go below it. Tune with `npm run auth:bench`.
 */
export const ARGON2_PARAMS: Argon2Params = { memoryKib: 65_536, timeCost: 3, parallelism: 1 };

/** `Algorithm.Argon2id`. The library's enum is a `const enum`, which cannot be imported under isolatedModules. */
const ARGON2ID = 2;
const OUTPUT_LENGTH = 32;
/** Anything longer than this is not a password; refuse without spending 64 MiB on it. */
const HARD_INPUT_LIMIT = 1_024;

export type PasswordConfig = {
  peppers: ReadonlyMap<number, string>;
  currentVersion: number;
  params: Argon2Params;
};

export function passwordConfigFromEnv(): PasswordConfig {
  const env = getEnv();
  return {
    peppers: loadPeppers(process.env),
    currentVersion: env.PASSWORD_PEPPER_CURRENT_VERSION,
    params: ARGON2_PARAMS,
  };
}

function options(config: PasswordConfig, pepper: string) {
  return {
    algorithm: ARGON2ID,
    memoryCost: config.params.memoryKib,
    timeCost: config.params.timeCost,
    parallelism: config.params.parallelism,
    outputLen: OUTPUT_LENGTH,
    secret: Buffer.from(pepper, "utf8"),
  };
}

/** Hash for storage: `pv<pepper version>:<PHC string>`. The caller has already checked the password policy. */
export async function hashPassword(
  password: string,
  config: PasswordConfig = passwordConfigFromEnv(),
): Promise<string> {
  const pepper = config.peppers.get(config.currentVersion);
  if (!pepper) throw new Error(`No pepper configured for version ${config.currentVersion}`);
  const phc = await hash(normalizePassword(password), options(config, pepper));
  return formatStoredHash(config.currentVersion, phc);
}

export type PasswordCheck = { valid: boolean; needsRehash: boolean };

let dummy: { key: PasswordConfig; hash: Promise<string> } | undefined;

/** Spends the same time as a real verification, for logins of unknown accounts (no account enumeration by timing). */
export async function verifyAgainstDummy(
  password: string,
  config: PasswordConfig = passwordConfigFromEnv(),
): Promise<void> {
  const pepper = config.peppers.get(config.currentVersion);
  if (!pepper) return;
  if (
    !dummy ||
    dummy.key.params !== config.params ||
    dummy.key.currentVersion !== config.currentVersion
  ) {
    dummy = { key: config, hash: hash("dummy-password-for-timing-only", options(config, pepper)) };
  }
  const phc = await dummy.hash;
  await verify(
    phc,
    normalizePassword(password).slice(0, HARD_INPUT_LIMIT),
    options(config, pepper),
  ).catch(() => false);
}

/**
 * Checks a password against a stored hash. Never throws for bad input: an unparsable hash, an unknown pepper version
 * or an absurdly long input is simply "not valid" (after the same cost, where that is possible). `needsRehash` is true
 * only for a VALID password whose hash uses an old pepper version or old parameters; the caller then stores a fresh
 * hash, which is how a pepper rotation completes without anyone resetting a password.
 */
export async function verifyPassword(
  password: string,
  stored: string,
  config: PasswordConfig = passwordConfigFromEnv(),
): Promise<PasswordCheck> {
  const normalized = normalizePassword(password);
  const parsed = parseStoredHash(stored);
  const pepper = parsed ? config.peppers.get(parsed.pepperVersion) : undefined;
  if (!parsed || !pepper || normalized.length > HARD_INPUT_LIMIT) {
    if (parsed && !pepper)
      logger.error("password_pepper_missing", { version: parsed.pepperVersion });
    await verifyAgainstDummy(password, config);
    return { valid: false, needsRehash: false };
  }
  const valid = await verify(parsed.phc, normalized, options(config, pepper)).catch(() => false);
  return {
    valid,
    needsRehash:
      valid && needsRehash(parsed, { pepperVersion: config.currentVersion, params: config.params }),
  };
}
