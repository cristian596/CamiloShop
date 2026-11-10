import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { dismissCookies } from "./helpers";

/** Automated WCAG 2.1 A/AA checks with axe on the main public pages. */
const PAGES = [
  ["home (es)", "/es"],
  ["home (en)", "/en"],
  ["category", "/es/c/ropa"],
  ["subcategory", "/es/c/tecnologia/audio"],
  ["product", "/es/p/camiseta-essential-algodon"],
  ["search", "/es/search?q=camiseta"],
  ["cart", "/es/cart"],
  ["login", "/es/login"],
  ["privacy policy", "/es/legal/privacy"],
] as const;

for (const [name, path] of PAGES) {
  test(`${name} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await dismissCookies(page);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(
      serious.map((violation) => ({
        id: violation.id,
        help: violation.help,
        targets: violation.nodes.map((node) => node.target.join(" ")).slice(0, 5),
      })),
    ).toEqual([]);
  });
}
