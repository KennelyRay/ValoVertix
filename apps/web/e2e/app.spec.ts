import { expect, test, type Page } from "@playwright/test";
import { FIXTURE_RIOT_ID, RIOT_ORIGINS, freshAccessUrl, mockRiot } from "./riot-mock";

/** CSP violations and runtime errors fail the test. */
function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(m.text());
  });
  return problems;
}

async function signInByPaste(page: Page, remember = false) {
  await page.goto("/");
  await page.getByLabel(/Paste the address/).fill(freshAccessUrl());
  if (remember) await page.getByLabel(/Remember this account/).check();
  await page.getByRole("button", { name: "Show my account" }).click();
  await expect(page.getByRole("heading", { name: FIXTURE_RIOT_ID })).toBeVisible({
    timeout: 15_000,
  });
}

test("demo flow works on every page @mobile", async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto("/?demo=1");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Estimated collection value")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/₱[\d,]+–₱[\d,]+/).first()).toBeVisible({ timeout: 20_000 });

  for (const [path, marker] of [
    ["/spending", "Based on standard PH VP pack prices."],
    ["/stats", "Recent matches"],
    ["/collection", "Search by name"],
    ["/share", "Download PNG"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByText(marker).first()).toBeVisible({ timeout: 20_000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
  }
  expect(problems).toEqual([]);
});

test("paste-URL flow sends tokens only to Riot", async ({ page }) => {
  const problems = watchConsole(page);
  const offenders: string[] = [];
  page.on("request", (req) => {
    const h = req.headers();
    const origin = new URL(req.url()).origin;
    const carries =
      Boolean(h["authorization"] || h["x-riot-entitlements-jwt"]) ||
      /access_token|eyJ/.test(req.url());
    if (carries && !RIOT_ORIGINS.includes(origin)) offenders.push(origin);
  });
  await mockRiot(page);
  await signInByPaste(page);

  // The paste box was cleared and the token is not in the address bar.
  expect(page.url()).not.toMatch(/token/);
  for (const path of ["/spending", "/stats", "/collection"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
  }
  expect(offenders).toEqual([]);
  expect(problems).toEqual([]);
});

test("exports a PNG at the chosen size", async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto("/?demo=1");
  await expect(page.getByText("Estimated collection value")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: "Share card" }).first().click();
  await page.getByText("Estimated value and top skins").click();
  await page.getByRole("combobox", { name: "Size" }).click();
  await page.getByRole("option", { name: "Link preview 1200 × 630" }).click();
  const button = page.getByRole("button", { name: "Download PNG" });
  await expect(button).toBeEnabled({ timeout: 20_000 });
  const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
  expect(download.suggestedFilename()).toBe("valovertix-spending-1200x630.png");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  const png = Buffer.concat(chunks);
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
  expect(problems).toEqual([]);
});

test("forget account removes it", async ({ page }) => {
  await mockRiot(page);
  await signInByPaste(page, true);
  await page.goto("/settings");
  await page.getByRole("button", { name: /Forget/ }).click();
  await expect(page.getByText("No accounts connected")).toBeVisible();
  await page.reload();
  await expect(page.getByText("No accounts connected")).toBeVisible();
});

test("clear all data leaves nothing behind", async ({ page }) => {
  await mockRiot(page);
  await signInByPaste(page, true);
  await page.goto("/collection");
  await expect(page.getByText("Search by name")).toBeVisible({ timeout: 20_000 });
  await page.goto("/settings");
  await page.getByRole("button", { name: "Clear all data" }).click();
  await page.getByRole("button", { name: "Yes, clear everything" }).click();
  await expect(page).toHaveURL(/\/$/);
  const state = await page.evaluate(async () => ({
    local: localStorage.length,
    session: sessionStorage.length,
    dbs: (await indexedDB.databases()).map((d) => d.name),
    workers: (await navigator.serviceWorker.getRegistrations()).length,
  }));
  expect(state).toEqual({ local: 0, session: 0, dbs: [], workers: 0 });
});
