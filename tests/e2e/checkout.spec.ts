import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers";

/**
 * The main purchase path, deterministic (cash on delivery, no payment gateway):
 * demo sign-in -> product -> cart -> checkout -> order in the account. The
 * order is cancelled at the end, which returns its stock.
 */
test("a visitor buys with cash on delivery and finds the order in the account", async ({
  page,
}) => {
  await signInAsDemo(page);

  await page.goto("/es/p/camiseta-essential-algodon");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Camiseta/);
  await page.getByRole("button", { name: "Agregar al carrito" }).click();

  await page.goto("/es/checkout");
  await expect(page.getByText("Camiseta Essential de algodón")).toBeVisible();
  await page.getByRole("radio", { name: /Pago contra entrega/ }).check();
  await page.getByRole("checkbox", { name: /Acepto los Términos/ }).check();
  await page.getByRole("button", { name: "Confirmar pedido" }).click();

  await expect(page.getByText("¡Recibimos tu pedido!")).toBeVisible();
  await expect(page).toHaveURL(/\/es\/account\/orders\/CS-\d{4}-\d{6}\?placed=1/);
  const number = /CS-\d{4}-\d{6}/.exec(page.url())?.[0];
  expect(number).toBeTruthy();

  await page.goto("/es/account/orders");
  await expect(page.getByRole("link", { name: new RegExp(number!) })).toBeVisible();

  // Clean up: cancel it (the confirmation dialog is accepted).
  await page.goto(`/es/account/orders/${number}`);
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Cancelar pedido" }).click();
  await expect(page.getByText("Cancelado").first()).toBeVisible();
});
