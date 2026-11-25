import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { codeFrom, waitForEmail } from "./emails";
import { expect, test } from "./fixtures";
import { whenHydrated } from "./helpers";

// Address book (M5b-2c, ADR 0029). Every test registers its own throw-away account (an address book is per account and
// these tests change it). Rules that need two accounts at once (no cross-account access, the limit under concurrency)
// are proven against real PostgreSQL in tests/db/address.db.test.ts; here the same rules are seen through the page.
const PASSWORD = "correct-horse-battery-staple-91";
let counter = 0;
const unique = (label: string) => `${label}-${Date.now()}-${counter++}@example.test`;

async function registerAndVerify(page: Page, email: string) {
  await page.goto("/en/register");
  await whenHydrated(page.getByRole("button", { name: "Create account" }));
  await page.getByLabel("First name").fill("Mona");
  await page.getByLabel("Last name").fill("Hassan");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mobile number").fill("010 1234 5678");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("checkbox", { name: /accept/i }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/en\/verify-email$/);
  const code = codeFrom(await waitForEmail(email));
  await whenHydrated(page.getByRole("button", { name: "Verify email" }));
  await page.getByLabel("6-digit code").fill(code);
  await expect(page).toHaveURL(/\/en\/account$/);
}

type Fields = {
  label?: string;
  governorate?: string;
  city?: string;
  area?: string;
  street?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  landmark?: string;
  phone?: string;
  makeDefault?: boolean;
};

const L = {
  en: {
    label: "Name for this address (optional)",
    phone: "Recipient's mobile number",
    governorate: "Governorate",
    city: "City or district",
    area: "Area or neighborhood",
    street: "Street",
    building: "Building name or number",
    floor: "Floor (optional)",
    apartment: "Apartment (optional)",
    landmark: "Nearby landmark (optional)",
  },
} as const;

async function fill(page: Page, f: Fields) {
  const l = L.en;
  const text = async (label: string, value: string | undefined) => {
    if (value !== undefined) await page.getByLabel(label, { exact: true }).fill(value);
  };
  await text(l.label, f.label);
  await text(l.phone, f.phone);
  if (f.governorate)
    await page.getByLabel(l.governorate, { exact: true }).selectOption({ label: f.governorate });
  await text(l.city, f.city);
  await text(l.area, f.area);
  await text(l.street, f.street);
  await text(l.building, f.building);
  await text(l.floor, f.floor);
  await text(l.apartment, f.apartment);
  await text(l.landmark, f.landmark);
  if (f.makeDefault)
    await page.getByRole("checkbox", { name: "Use as my default address" }).check();
}

const base: Fields = {
  governorate: "Cairo",
  city: "Nasr City",
  area: "Seventh District",
  street: "Abbas El Akkad",
  building: "12",
};

const cards = (page: Page) => page.getByTestId("address-card");
const notice = (page: Page) => page.getByTestId("address-notice");

/** Opens the add form (the first address uses the empty-state button, later ones the header button), fills and saves. */
async function addAddress(page: Page, f: Fields) {
  const add = page.getByTestId("address-add");
  await whenHydrated(add);
  const before = await cards(page).count();
  await add.click();
  await expect(page.getByTestId("address-form")).toBeVisible();
  await fill(page, { ...base, ...f });
  await page.getByRole("button", { name: "Save address" }).click();
  await expect(cards(page)).toHaveCount(before + 1);
}

async function openAddresses(page: Page, email: string) {
  await registerAndVerify(page, email);
  await page.goto("/en/account/addresses");
  await expect(page.getByRole("heading", { level: 1, name: "Addresses" })).toBeVisible();
}

test.describe("address book", () => {
  test("is a section of the account area and of the header menu, and needs a session", async ({
    page,
  }) => {
    await page.goto("/en/account/addresses");
    await expect(page).toHaveURL(/\/en\/login\?next=%2Faccount%2Faddresses/);
    await registerAndVerify(page, unique("sections"));
    await page.getByTestId("account-menu-trigger").click();
    await page.getByTestId("account-menu-panel").getByRole("link", { name: "Addresses" }).click();
    await expect(page).toHaveURL(/\/en\/account\/addresses$/);
    await expect(page.getByTestId("account-nav-addresses")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("address-empty")).toBeVisible();
  });

  test("the first address becomes the default; the form is pre-filled from the profile and the overview counts it", async ({
    page,
  }) => {
    await openAddresses(page, unique("first"));
    await expect(page.getByText("You haven't saved an address yet.")).toBeVisible();
    await whenHydrated(page.getByTestId("address-add"));
    await page.getByTestId("address-add").click();
    await expect(page.getByLabel("Recipient's full name")).toHaveValue("Mona Hassan");
    await expect(page.getByLabel("Recipient's mobile number")).toHaveValue("01012345678");
    await expect(page.getByText("Your first address becomes your default address.")).toBeVisible();
    // Focus moved to the form heading, so a keyboard user lands on the new content.
    await expect(page.getByRole("heading", { name: "New address" })).toBeFocused();
    await fill(page, {
      ...base,
      label: "Home",
      floor: "3",
      apartment: "9",
      landmark: "Next to the pharmacy",
    });
    await page.getByRole("button", { name: "Save address" }).click();

    await expect(notice(page)).toHaveText("Address added.");
    await expect(cards(page)).toHaveCount(1);
    const card = cards(page).first();
    await expect(card.getByRole("heading", { level: 3 })).toHaveText("Home");
    await expect(card.getByTestId("address-default-badge")).toBeVisible();
    await expect(card).toContainText("Mona Hassan");
    await expect(card).toContainText("01012345678");
    await expect(card).toContainText("12, Abbas El Akkad");
    await expect(card).toContainText("Floor 3, Apartment 9");
    await expect(card).toContainText("Seventh District, Nasr City");
    await expect(card).toContainText("Cairo");
    await expect(card).toContainText("Landmark: Next to the pharmacy");
    await expect(page.getByRole("heading", { name: "Saved addresses" })).toBeFocused();

    await page.goto("/en/account");
    await expect(page.getByTestId("overview-addresses")).toHaveText("You have 1 saved address.");
  });

  test("shows a translated error per field and moves focus to the first one", async ({ page }) => {
    await openAddresses(page, unique("errors"));
    await whenHydrated(page.getByTestId("address-add"));
    await page.getByTestId("address-add").click();
    await page.getByLabel("Recipient's mobile number").fill("12345");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByText("Enter an Egyptian mobile number like 01012345678")).toBeVisible();
    await expect(page.getByText("Choose a governorate from the list.")).toBeVisible();
    await expect(page.getByText("This field is required.")).toHaveCount(4); // city, area, street, building
    await expect(page.getByLabel("Recipient's mobile number")).toBeFocused();
    await expect(cards(page)).toHaveCount(0);
    // Cancel closes the form without saving anything.
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("address-form")).toHaveCount(0);
    await expect(page.getByTestId("address-empty")).toBeVisible();
  });

  test("a second address, set as default, edited, with exactly one default at every step", async ({
    page,
  }) => {
    await openAddresses(page, unique("default"));
    await addAddress(page, { label: "Home" });
    await addAddress(page, { label: "Office", governorate: "Giza", city: "Dokki", area: "Mesaha" });
    const badges = page.getByTestId("address-default-badge");
    await expect(badges).toHaveCount(1);
    // The newest comes second in the list: the default is always first.
    await expect(cards(page).first().getByRole("heading", { level: 3 })).toHaveText("Home");

    // Set the other one as the default: the badge moves, the list reorders, the result is announced.
    const office = cards(page).filter({ hasText: "Office" });
    await office.getByTestId("address-set-default").click();
    await expect(notice(page)).toHaveText("Default address updated.");
    await expect(badges).toHaveCount(1);
    await expect(cards(page).first().getByRole("heading", { level: 3 })).toHaveText("Office");
    await expect(cards(page).first().getByTestId("address-default-badge")).toBeVisible();

    // Edit the non-default one; it keeps its place and stays non-default.
    const home = cards(page).filter({ hasText: "Home" });
    await home.getByTestId("address-edit").click();
    await expect(page.getByRole("heading", { name: "Edit address" })).toBeFocused();
    await expect(page.getByLabel("Name for this address (optional)")).toHaveValue("Home");
    await page.getByLabel("Street", { exact: true }).fill("Tahrir Street");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(notice(page)).toHaveText("Address saved.");
    await expect(cards(page).filter({ hasText: "Tahrir Street" })).toHaveCount(1);
    await expect(
      cards(page).filter({ hasText: "Home" }).getByTestId("address-default-badge"),
    ).toHaveCount(0);
    await expect(badges).toHaveCount(1);

    // "Use as my default" while adding a third.
    await addAddress(page, { label: "Parents", makeDefault: true });
    await expect(badges).toHaveCount(1);
    await expect(cards(page).first().getByRole("heading", { level: 3 })).toHaveText("Parents");
  });

  test("deleting asks first (the safe choice has focus), a delete of the default promotes another, the last one leaves the empty state", async ({
    page,
  }) => {
    await openAddresses(page, unique("delete"));
    await addAddress(page, { label: "Home" });
    await addAddress(page, { label: "Office" });

    const home = cards(page).filter({ hasText: "Home" });
    await home.getByTestId("address-delete").click();
    await expect(home.getByText("Delete this address?")).toBeVisible();
    await expect(home.getByRole("button", { name: "Keep it" })).toBeFocused();
    await home.getByRole("button", { name: "Keep it" }).click();
    await expect(home.getByTestId("address-delete")).toBeFocused();
    await expect(cards(page)).toHaveCount(2);

    // Home is the default; deleting it makes Office the default.
    await home.getByTestId("address-delete").click();
    await home.getByTestId("address-delete-confirm").click();
    await expect(notice(page)).toHaveText("Address deleted.");
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText("Office");
    await expect(cards(page).first().getByTestId("address-default-badge")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Saved addresses" })).toBeFocused();

    await cards(page).first().getByTestId("address-delete").click();
    await cards(page).first().getByTestId("address-delete-confirm").click();
    await expect(page.getByTestId("address-empty")).toBeVisible();
    await page.goto("/en/account");
    await expect(page.getByTestId("overview-addresses")).toHaveText(
      "Save a delivery address so checkout is quicker.",
    );
  });

  test("the limit of ten: the add button goes away and says why; deleting one brings it back", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await openAddresses(page, unique("limit"));
    for (let i = 1; i <= 10; i++) await addAddress(page, { building: `${i}` });
    await expect(page.getByTestId("address-limit")).toHaveText(
      "You have saved the maximum of 10 addresses. Delete one to add another.",
    );
    await expect(page.getByTestId("address-add")).toHaveCount(0);
    await expect(page.getByTestId("address-default-badge")).toHaveCount(1);
    await cards(page).last().getByTestId("address-delete").click();
    await cards(page).last().getByTestId("address-delete-confirm").click();
    await expect(cards(page)).toHaveCount(9);
    await expect(page.getByTestId("address-add")).toBeVisible();
  });

  test("another account's address book starts empty (nothing is shared between accounts)", async ({
    page,
    browser,
    baseURL,
  }) => {
    await openAddresses(page, unique("owner"));
    await addAddress(page, { label: "Secret" });
    const context = await browser.newContext({ baseURL });
    const other = await context.newPage();
    await registerAndVerify(other, unique("other"));
    await other.goto("/en/account/addresses");
    await expect(other.getByTestId("address-empty")).toBeVisible();
    await expect(other.getByText("Secret")).toHaveCount(0);
    await context.close();
  });

  test("Arabic: right-to-left, Arabic governorate names, Arabic text saved and shown, no sideways scroll at 320px", async ({
    page,
  }) => {
    await registerAndVerify(page, unique("arabic"));
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/ar/account/addresses");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1, name: "العناوين" })).toBeVisible();
    await whenHydrated(page.getByTestId("address-add"));
    await page.getByTestId("address-add").click();
    await page.getByLabel("المحافظة").selectOption({ label: "القاهرة" });
    await page.getByLabel("المدينة أو المركز", { exact: true }).fill("مدينة نصر");
    await page.getByLabel("المنطقة أو الحي", { exact: true }).fill("الحي السابع");
    await page.getByLabel("الشارع", { exact: true }).fill("عباس العقاد");
    await page.getByLabel("اسم المبنى أو رقمه", { exact: true }).fill("١٢");
    await page.getByRole("button", { name: "حفظ العنوان" }).click();
    await expect(notice(page)).toHaveText("تمت إضافة العنوان.");
    const card = cards(page).first();
    await expect(card).toContainText("القاهرة");
    await expect(card).toContainText("مدينة نصر");
    await expect(card.getByTestId("address-default-badge")).toHaveText("الافتراضي");
    // The phone stays left-to-right inside the right-to-left card.
    await expect(card.locator("bdi[dir=ltr]")).toContainText("01012345678");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
    // The same address reads in English on the English page (the governorate is stored as a code, not a name).
    await page.goto("/en/account/addresses");
    await expect(cards(page).first()).toContainText("Cairo");
  });

  test("populated list and open form: no sideways scroll and 44px targets at five widths, in both languages", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openAddresses(page, unique("responsive"));
    await addAddress(page, { label: "Home", landmark: "Next to the pharmacy" });
    await addAddress(page, {
      label: "Office",
      governorate: "Kafr El Sheikh",
      street: "A very long street name that has to wrap inside the card on a narrow phone",
    });
    for (const locale of ["en", "ar"] as const) {
      for (const width of [320, 390, 768, 1280, 1920]) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(`/${locale}/account/addresses`);
        await expect(cards(page)).toHaveCount(2);
        await whenHydrated(page.getByTestId("address-edit").first());
        await page.getByTestId("address-edit").first().click();
        await expect(page.getByTestId("address-form")).toBeVisible();
        const sizes = await page.evaluate(() => {
          const controls = [
            ...document.querySelectorAll<HTMLElement>(
              "[data-testid=address-card] button, [data-testid=address-form] button, [data-testid=address-form] input:not([type=checkbox]), [data-testid=address-form] select",
            ),
          ];
          return {
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            small: controls
              .map((el) => ({
                name: el.textContent?.trim() || el.id,
                h: Math.round(el.getBoundingClientRect().height),
              }))
              .filter((c) => c.h < 44),
          };
        });
        expect(sizes.overflow, `${locale} ${width}`).toBeLessThanOrEqual(0);
        expect(sizes.small, `${locale} ${width}`).toEqual([]);
      }
    }
  });

  test("axe (WCAG 2.2 AA): the list, the open form and the delete question, in both languages and themes", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openAddresses(page, unique("axe"));
    await addAddress(page, { label: "Home", landmark: "Next to the pharmacy" });
    await addAddress(page, { label: "Office", governorate: "Alexandria", city: "Smouha" });
    const audit = async (name: string) => {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
        ),
        name,
      ).toEqual([]);
    };
    for (const locale of ["en", "ar"] as const) {
      for (const theme of ["dark", "light"] as const) {
        // Init scripts run in the order they were added, so the newest value is the one the page sees.
        await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
        await page.goto(`/${locale}/account/addresses`);
        await expect(cards(page)).toHaveCount(2);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await audit(`${locale} ${theme} list`);
        await whenHydrated(page.getByTestId("address-delete").first());
        await page.getByTestId("address-delete").first().click();
        await expect(page.getByTestId("address-delete-confirm")).toBeVisible();
        await audit(`${locale} ${theme} delete question`);
        await page.getByTestId("address-edit").last().click();
        await expect(page.getByTestId("address-form")).toBeVisible();
        await audit(`${locale} ${theme} form`);
      }
    }
  });
});
