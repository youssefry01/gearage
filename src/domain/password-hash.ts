/**
 * Stored password-hash format (ADR 0003): `pv<N>:<PHC string>`, for example
 * `pv1:$argon2id$v=19$m=65536,t=3,p=1$<salt>$<hash>`.
 * `pv<N>` is the PEPPER VERSION used for that hash, so a pepper can be rotated: new hashes use the current version,
 * old ones still verify with their own pepper and are rehashed at the next successful login. The PHC string carries
 * the Argon2 variant, version, parameters and the per-hash random salt.
 */
export type Argon2Params = { memoryKib: number; timeCost: number; parallelism: number };

export type StoredHash = { pepperVersion: number; phc: string; params: Argon2Params };

const STORED =
  /^pv([1-9]\d{0,3}):(\$argon2id\$v=\d+\$m=(\d+),t=(\d+),p=(\d+)\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+)$/;

export function formatStoredHash(pepperVersion: number, phc: string): string {
  return `pv${pepperVersion}:${phc}`;
}

/** Null when the string is not in our format (a corrupt or foreign hash never verifies). */
export function parseStoredHash(stored: string): StoredHash | null {
  const m = STORED.exec(stored);
  if (!m) return null;
  return {
    pepperVersion: Number(m[1]),
    phc: m[2] as string,
    params: { memoryKib: Number(m[3]), timeCost: Number(m[4]), parallelism: Number(m[5]) },
  };
}

/** True when the hash should be replaced at the next successful login: old pepper version or different parameters. */
export function needsRehash(
  stored: StoredHash,
  current: { pepperVersion: number; params: Argon2Params },
): boolean {
  return (
    stored.pepperVersion !== current.pepperVersion ||
    stored.params.memoryKib !== current.params.memoryKib ||
    stored.params.timeCost !== current.params.timeCost ||
    stored.params.parallelism !== current.params.parallelism
  );
}
