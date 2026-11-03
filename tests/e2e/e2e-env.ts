/**
 * Throw-away secrets for the e2e web server (playwright.config.ts passes them to `npm run start`). They live in one
 * place so helpers that must sign something the server will accept (the pending-verification cookie) use the same value.
 */
export const E2E_AUTH_SECRET = "e2e-only-auth-secret-e2e-only-auth-secret-0001";
export const E2E_PASSWORD_PEPPER = "e2e-only-pepper-e2e-only-pepper-000000000001";

/** Where the global setup saves the signed-in session used by the page matrices (gitignored). */
export const AUTH_STATE_FILE = "tests/.auth/user.json";
