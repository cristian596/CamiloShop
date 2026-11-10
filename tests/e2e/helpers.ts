import { expect, type Page } from "@playwright/test";

/** Closes the cookie banner (only shown when GA is configured) by rejecting. */
export async function dismissCookies(page: Page) {
  const reject = page.getByRole("button", { name: "Rechazar" });
  if (await reject.isVisible().catch(() => false)) await reject.click();
}

/** Signs in with the shared demo customer ("Entrar como demo"). */
export async function signInAsDemo(page: Page, next = "/es/account") {
  await page.goto(`/es/login?next=${encodeURIComponent(next)}`);
  await dismissCookies(page);
  await page.getByRole("button", { name: "Entrar como demo" }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/[/?]/g, "\$&")}`));
}
