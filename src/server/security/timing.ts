const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs `fn` and makes sure the call takes at least `minMs` in total, whether it succeeds or throws. Used where the
 * work differs by whether an email exists (register, forgot password, resend code) so the response time does not
 * reveal it. The floor must exceed the slowest branch; the expensive part (sending email) happens outside the
 * request through the outbox, so both branches are a few database statements.
 */
export async function withMinimumDuration<T>(
  minMs: number,
  fn: () => Promise<T>,
  clock: { now: () => number; sleep: (ms: number) => Promise<void> } = {
    now: () => performance.now(),
    sleep: defaultSleep,
  },
): Promise<T> {
  const start = clock.now();
  const wait = async () => {
    const remaining = minMs - (clock.now() - start);
    if (remaining > 0) await clock.sleep(remaining);
  };
  try {
    const value = await fn();
    await wait();
    return value;
  } catch (err) {
    await wait();
    throw err;
  }
}
