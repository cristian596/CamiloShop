"use client";

import { Banknote, CreditCard, Loader2, MapPin, Tag, Truck, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { Button, buttonClasses } from "@/components/ui/button";
import { FormMessage, TextInput } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { focusRing } from "@/components/ui/styles";
import { Price } from "@/components/layout/price";
import { AddressForm, type AddressView } from "@/features/account/address-manager";
import { CartChangeNotices } from "@/features/cart/cart-view";
import { useVariantLabel } from "@/features/cart/cart-line-item";
import { useCartSync } from "@/features/cart/use-cart-sync";
import { useCart } from "@/stores/cart";
import { placeOrderAction, quoteCheckoutAction, type PlaceOrderActionResult } from "./actions";
import type { Quote } from "./place-order";

const sectionClass = "flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6";
const linkClass = cn(
  "rounded-sm font-medium text-primary-fg underline-offset-4 hover:underline",
  focusRing,
);

function SectionTitle({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 font-display text-lg font-semibold">
      <span
        aria-hidden="true"
        className="grid size-7 place-items-center rounded-full bg-primary text-sm text-on-primary"
      >
        {step}
      </span>
      {children}
    </h2>
  );
}

export function CheckoutForm({
  addresses,
  cities,
}: {
  addresses: AddressView[];
  cities: string[];
}) {
  const t = useTranslations("Checkout");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const variantLabel = useVariantLabel();
  const { synced, changes, previous } = useCartSync();
  const lines = useCart((state) => state.lines);
  const setQuantity = useCart((state) => state.setQuantity);
  const clearCart = useCart((state) => state.clear);

  const [addressId, setAddressId] = useState<string | null>(
    addresses.find((address) => address.isDefault)?.id ?? addresses[0]?.id ?? null,
  );
  const [addingAddress, setAddingAddress] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, startQuote] = useTransition();
  const [placing, startPlacing] = useTransition();
  const [result, setResult] = useState<PlaceOrderActionResult | null>(null);

  const cartKey = useMemo(
    () => lines.map((line) => `${line.variantId}:${line.quantity}`).join(","),
    [lines],
  );

  // A selected address that was just deleted elsewhere falls back to the first one.
  const selectedAddressId = addresses.some((address) => address.id === addressId)
    ? addressId
    : (addresses[0]?.id ?? null);

  useEffect(() => {
    if (!synced || !cartKey) return;
    startQuote(async () => {
      const response = await quoteCheckoutAction({
        lines: useCart.getState().lines.map(({ variantId, quantity }) => ({ variantId, quantity })),
        addressId: selectedAddressId,
        couponCode: appliedCoupon,
      });
      if (response.ok) setQuote(response.quote);
      else if (response.error === "auth") router.push("/login?next=/checkout");
    });
  }, [synced, cartKey, selectedAddressId, appliedCoupon, router]);

  /** Lowers quantities to what the server says is in stock. */
  function fixCartFromQuote() {
    if (!quote) return;
    for (const issue of quote.issues) {
      setQuantity(issue.variantId, issue.reason === "insufficientStock" ? issue.stock : 0);
    }
    setResult(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAddressId) return;
    startPlacing(async () => {
      const response = await placeOrderAction({
        lines: lines.map(({ variantId, quantity }) => ({ variantId, quantity })),
        addressId: selectedAddressId,
        couponCode: appliedCoupon,
        paymentMethod: "COD",
        acceptTerms,
      });
      setResult(response);
      if (response.ok) {
        clearCart();
        router.push(`/account/orders/${encodeURIComponent(response.number)}?placed=1`);
      }
    });
  }

  if (!synced) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_400px]" aria-busy="true">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  if (lines.length === 0 && !placing && !result?.ok) {
    return (
      <div className="flex flex-col gap-6">
        <CartChangeNotices changes={changes} previous={previous} />
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <p className="text-muted">{t("emptyCart")}</p>
          <Link href="/" className={buttonClasses({ variant: "outline" })}>
            {t("continueShopping")}
          </Link>
        </div>
      </div>
    );
  }

  const totals = quote?.totals;
  const couponError = quote?.coupon && !quote.coupon.ok ? quote.coupon : null;
  const hasIssues = (quote?.issues.length ?? 0) > 0;
  const issueName = (variantId: string) =>
    lines.find((line) => line.variantId === variantId)?.name[locale] ?? "";
  const failure = result && !result.ok ? result : null;
  const canPlace =
    Boolean(selectedAddressId) && acceptTerms && !hasIssues && !couponError && !quoting && !placing;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_400px]">
      <div className="flex flex-col gap-6">
        <CartChangeNotices changes={changes} previous={previous} />

        {/* 1. Address */}
        <section aria-labelledby="checkout-address" className={sectionClass}>
          <SectionTitle step={1}>
            <span id="checkout-address">{t("addressTitle")}</span>
          </SectionTitle>
          {addresses.length > 0 && !addingAddress ? (
            <fieldset className="flex flex-col gap-3">
              <legend className="sr-only">{t("addressTitle")}</legend>
              {addresses.map((address) => (
                <label
                  key={address.id}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-xl border p-4 text-sm transition-colors has-focus-visible:outline-2 has-focus-visible:outline-focus",
                    selectedAddressId === address.id
                      ? "border-primary bg-surface-raised"
                      : "border-line hover:border-primary-fg/50",
                  )}
                >
                  <input
                    type="radio"
                    name="addressId"
                    value={address.id}
                    checked={selectedAddressId === address.id}
                    onChange={() => setAddressId(address.id)}
                    className="mt-1 size-4 accent-primary"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold">{address.label}</span>
                    <span className="text-muted">
                      {address.recipient} · {address.phone}
                    </span>
                    <span className="text-muted">
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ""} — {address.city},{" "}
                      {address.department}
                    </span>
                  </span>
                </label>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => setAddingAddress(true)}
              >
                <MapPin className="size-4" aria-hidden="true" />
                {t("addAddress")}
              </Button>
            </fieldset>
          ) : (
            <>
              {addresses.length === 0 ? (
                <p className="text-sm text-muted">{t("noAddress")}</p>
              ) : null}
              <AddressForm
                address={null}
                cities={cities}
                onDone={() => {
                  setAddingAddress(false);
                  router.refresh();
                }}
              />
            </>
          )}
          {quote?.shippingEtaDays ? (
            <p className="flex items-center gap-2 text-sm text-cyan-fg">
              <Truck className="size-4" aria-hidden="true" />
              {t("eta", { days: quote.shippingEtaDays })}
            </p>
          ) : null}
        </section>

        {/* 2. Coupon */}
        <section aria-labelledby="checkout-coupon" className={sectionClass}>
          <SectionTitle step={2}>
            <span id="checkout-coupon">{t("couponTitle")}</span>
          </SectionTitle>
          {appliedCoupon && quote?.coupon?.ok ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-pink-fg/40 p-3 text-sm">
              <span className="flex items-center gap-2">
                <Tag className="size-4 text-pink-fg" aria-hidden="true" />
                {t.rich("couponApplied", {
                  code: quote.coupon.code,
                  amount: () => <Price amount={quote.coupon?.ok ? quote.coupon.discount : 0} />,
                })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAppliedCoupon("");
                  setCouponInput("");
                }}
              >
                <X className="size-4" aria-hidden="true" />
                {t("removeCoupon")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label htmlFor="coupon-code" className="text-sm font-medium">
                {t("couponLabel")}
              </label>
              <div className="flex gap-2">
                <TextInput
                  id="coupon-code"
                  value={couponInput}
                  onChange={(event) => setCouponInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      setAppliedCoupon(couponInput.trim());
                    }
                  }}
                  autoComplete="off"
                  maxLength={32}
                  className="uppercase"
                  aria-invalid={couponError ? true : undefined}
                  aria-describedby={couponError ? "coupon-error" : "coupon-hint"}
                />
                <Button
                  variant="outline"
                  onClick={() => setAppliedCoupon(couponInput.trim())}
                  disabled={!couponInput.trim()}
                >
                  {t("applyCoupon")}
                </Button>
              </div>
              {couponError ? (
                <p id="coupon-error" role="alert" className="text-xs font-medium text-pink-fg">
                  {couponError.error === "minSubtotal"
                    ? t.rich("couponErrors.minSubtotal", {
                        amount: () => <Price amount={couponError.minSubtotal ?? 0} />,
                      })
                    : t(`couponErrors.${couponError.error}`)}
                </p>
              ) : (
                <p id="coupon-hint" className="text-xs text-muted">
                  {t("couponHint")}
                </p>
              )}
            </div>
          )}
        </section>

        {/* 3. Payment */}
        <section aria-labelledby="checkout-payment" className={sectionClass}>
          <SectionTitle step={3}>
            <span id="checkout-payment">{t("paymentTitle")}</span>
          </SectionTitle>
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">{t("paymentTitle")}</legend>
            <label className="flex cursor-pointer gap-3 rounded-xl border border-primary bg-surface-raised p-4 text-sm has-focus-visible:outline-2 has-focus-visible:outline-focus">
              <input
                type="radio"
                name="paymentMethod"
                value="COD"
                defaultChecked
                className="mt-1 size-4 accent-primary"
              />
              <Banknote className="mt-0.5 size-5 shrink-0 text-primary-fg" aria-hidden="true" />
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">{t("cod")}</span>
                <span className="text-muted">{t("codHint")}</span>
              </span>
            </label>
            <div
              aria-disabled="true"
              className="flex gap-3 rounded-xl border border-dashed border-line p-4 text-sm text-muted"
            >
              <CreditCard className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">{t("cardPse")}</span>
                <span>{t("cardPseSoon")}</span>
              </span>
            </div>
          </fieldset>
        </section>
      </div>

      {/* Summary */}
      <aside
        aria-labelledby="checkout-summary"
        aria-busy={quoting}
        className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6 lg:sticky lg:top-32"
      >
        <h2 id="checkout-summary" className="font-display text-lg font-semibold">
          {t("summaryTitle")}
        </h2>

        <ul className="flex flex-col gap-3 text-sm">
          {lines.map((line) => {
            const label = variantLabel(line);
            const fresh = quote?.lines.find((item) => item.variantId === line.variantId);
            return (
              <li key={line.variantId} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-medium">{line.name[locale]}</span>
                  <span className="block text-xs text-muted">
                    {label ? `${label} · ` : ""}× {line.quantity}
                  </span>
                </span>
                <Price amount={(fresh?.unitPrice ?? line.unitPrice) * line.quantity} />
              </li>
            );
          })}
        </ul>

        {hasIssues && quote ? (
          <FormMessage tone="error">
            <p className="font-semibold">{t("issuesTitle")}</p>
            <ul className="mt-1 list-disc pl-4">
              {quote.issues.map((issue) => (
                <li key={issue.variantId}>
                  {issue.reason === "unavailable"
                    ? t("issueUnavailable", { name: issueName(issue.variantId) })
                    : t("issueStock", { name: issueName(issue.variantId), count: issue.stock })}
                </li>
              ))}
            </ul>
            <Button variant="outline" size="sm" className="mt-3" onClick={fixCartFromQuote}>
              {t("fixCart")}
            </Button>
          </FormMessage>
        ) : null}

        {totals ? (
          <dl className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">{t("subtotal")}</dt>
              <dd>
                <Price amount={totals.subtotal} />
              </dd>
            </div>
            {totals.discount > 0 ? (
              <div className="flex justify-between text-pink-fg">
                <dt>{t("discount")}</dt>
                <dd>
                  -<Price amount={totals.discount} />
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-muted">{t("shipping")}</dt>
              <dd>
                {!quote?.address ? (
                  <span className="text-muted">{t("shippingPending")}</span>
                ) : totals.shippingCost === 0 ? (
                  <span className="font-semibold text-cyan-fg">{t("free")}</span>
                ) : (
                  <Price amount={totals.shippingCost} />
                )}
              </dd>
            </div>
            {!totals.freeShipping && totals.remainingForFreeShipping > 0 ? (
              <p className="text-xs text-cyan-fg">
                {t.rich("freeShippingHint", {
                  amount: () => <Price amount={totals.remainingForFreeShipping} />,
                })}
              </p>
            ) : null}
            <div className="mt-2 flex justify-between border-t border-line pt-3">
              <dt className="text-muted">{t("taxBase")}</dt>
              <dd>
                <Price amount={totals.taxBase} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">
                {t("tax", { rate: Math.round((quote?.taxRate ?? 0.19) * 100) })}
              </dt>
              <dd>
                <Price amount={totals.taxAmount} />
              </dd>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
              <dt className="font-semibold">{t("total")}</dt>
              <dd>
                <Price amount={totals.total} className="font-display text-2xl font-bold" />
              </dd>
            </div>
            <p className="text-xs text-muted">{t("copNote")}</p>
          </dl>
        ) : (
          <Skeleton className="h-40" />
        )}

        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(event) => setAcceptTerms(event.target.checked)}
              aria-describedby={failure?.error === "terms" ? "terms-error" : undefined}
              className={cn("mt-0.5 size-4 shrink-0 accent-primary", focusRing)}
            />
            <span className="text-muted">
              {t.rich("acceptTerms", {
                terms: (chunks) => (
                  <Link href="/legal/terms" target="_blank" className={linkClass}>
                    {chunks}
                  </Link>
                ),
                privacy: (chunks) => (
                  <Link href="/legal/privacy" target="_blank" className={linkClass}>
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </label>

          {failure ? (
            <div id="terms-error">
              <FormMessage tone="error">
                {failure.error === "coupon" && "couponError" in failure && failure.couponError
                  ? t(`couponErrors.${failure.couponError}`)
                  : t(`errors.${failure.error}`)}
              </FormMessage>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canPlace}
            className={buttonClasses({ size: "lg", className: "w-full" })}
          >
            {placing ? (
              <>
                <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                {t("placing")}
              </>
            ) : (
              t("placeOrder")
            )}
          </button>
          {!acceptTerms ? (
            <p className="text-center text-xs text-muted">{t("termsRequired")}</p>
          ) : null}
        </form>
      </aside>
    </div>
  );
}
