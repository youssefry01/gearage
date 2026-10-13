import { expect, test } from "./fixtures";

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

  await page.goto("/en");
  await page.getByRole("link", { name: "العربية" }).click();
  await expect(page).toHaveURL(/\/ar$/);
  await page.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en$/);
  await page.getByRole("button", { name: "Light" }).click();
  await page.getByRole("link", { name: "العربية" }).click();
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
