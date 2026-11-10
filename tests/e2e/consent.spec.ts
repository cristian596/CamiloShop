import { expect, test, type Page } from "@playwright/test";

/**
 * Google Analytics must not receive anything before the visitor accepts.
 * Runs when the server was built with NEXT_PUBLIC_GA_MEASUREMENT_ID (as in CI);
 * Google is never contacted: its requests are answered locally.
 */
async function watchGoogle(page: Page) {
  const requests: string[] = [];
  await page.route(/googletagmanager\.com|google-analytics\.com/, (route) => {
    requests.push(route.request().url());
    return route.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
  return requests;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/es");
  const banner = page.getByRole("dialog", { name: "Usamos cookies" });
  test.skip(!(await banner.isVisible().catch(() => false)), "GA is not configured on this server");
});

test("nothing is sent to Google before consent, and gtag loads after accepting", async ({
  page,
}) => {
  const requests = await watchGoogle(page);
  await page.reload();
  await page.waitForLoadState("networkidle");
  expect(requests).toEqual([]);

  await page.getByRole("button", { name: "Aceptar" }).click();
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(requests[0]).toContain("googletagmanager.com/gtag/js?id=G-");

  // The choice is remembered: no banner on the next page.
  await page.goto("/es/c/ropa");
  await expect(page.getByRole("dialog", { name: "Usamos cookies" })).toBeHidden();
});

test("rejecting keeps Google out, also on later pages", async ({ page }) => {
  const requests = await watchGoogle(page);
  await page.getByRole("button", { name: "Rechazar" }).click();
  await page.goto("/es/p/camiseta-essential-algodon");
  await page.waitForLoadState("networkidle");
  expect(requests).toEqual([]);
  await expect(page.getByRole("dialog", { name: "Usamos cookies" })).toBeHidden();
});
