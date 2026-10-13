import { test as base, expect } from "@playwright/test";

/**
 * Shared test object. By default every browser context starts WITH a saved cookie-consent choice, so the consent
 * banner does not cover the page under test. Specs that test the banner opt out with `test.use({ consent: false })`.
 */
export const test = base.extend<{ consent: boolean }>({
  consent: [true, { option: true }],
  context: async ({ context, consent, baseURL }, provide) => {
    if (consent && baseURL) {
      const value = encodeURIComponent(JSON.stringify({ v: 1, analytics: false, ts: 1 }));
      await context.addCookies([{ name: "consent", value, url: baseURL }]);
    }
    await provide(context);
  },
});

export { expect };
