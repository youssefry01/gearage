import { expect, test } from "./fixtures";
import { whenHydrated } from "./helpers";

/**
 * React and Next only emit most warnings in DEVELOPMENT, so this spec is meaningful against `next dev`
 * (the default for `npm run test:e2e` locally). It also passes on a production build.
 */
test("no console errors or warnings across navigation, locale switch and theme toggle", async ({
  page,
}) => {
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning")
      problems.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => problems.push(`[pageerror] ${err.message}`));

  // The home page is large, so a click that lands before React hydrates is lost: wait for the real signal first.
  const click = async (role: "link" | "button", name: string) => {
    const target = page.getByRole(role, { name });
    await whenHydrated(target);
    await target.click();
  };

  await page.goto("/en");
  await click("link", "العربية");
  await expect(page).toHaveURL(/\/ar$/);
  await click("link", "English");
  await expect(page).toHaveURL(/\/en$/);
  await click("button", "Light");
  await click("link", "العربية");
  await expect(page).toHaveURL(/\/ar$/);
  await page.goto("/en/styleguide");

  expect(problems).toEqual([]);
});

test("a saved theme survives a locale switch (the layout remounts on the client)", async ({
  page,
}) => {
  await page.goto("/en");
  await page.getByRole("button", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("link", { name: "العربية" }).click();
  await expect(page).toHaveURL(/\/ar$/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("header img.logo-on-light")).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
