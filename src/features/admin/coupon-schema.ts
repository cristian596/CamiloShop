import { z } from "zod";
import { MAX_PRICE } from "./product-schema";

/** Colombia has no daylight saving time: store times are always UTC-5. */
const STORE_OFFSET = "-05:00";

/** "2026-11-30T23:59" typed in a datetime-local input -> the instant in Colombia. */
export function parseStoreDateTime(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00${STORE_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The inverse, to prefill a datetime-local input. */
export function toStoreDateTimeInput(date: Date | null): string {
  if (!date) return "";
  const shifted = new Date(date.getTime() - 5 * 60 * 60_000);
  return shifted.toISOString().slice(0, 16);
}

const optionalDate = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    const date = parseStoreDateTime(value);
    if (!date) {
      ctx.addIssue({ code: "custom", message: "invalid" });
      return z.NEVER;
    }
    return date;
  });

export const couponSchema = z
  .object({
    // Same format the checkout accepts (normalizeCouponCode).
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{2,32}$/, { error: "invalid" }),
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.coerce.number({ error: "valueInvalid" }).int({ error: "valueInvalid" }),
    isActive: z.boolean(),
    startsAt: optionalDate,
    endsAt: optionalDate,
    maxUses: z
      .union([z.literal(""), z.coerce.number()])
      .transform((value) => (value === "" ? null : value))
      .pipe(
        z.number().int({ error: "invalid" }).min(1, { error: "invalid" }).max(1_000_000).nullable(),
      ),
    minSubtotal: z.coerce
      .number({ error: "invalid" })
      .int({ error: "invalid" })
      .min(0, { error: "invalid" })
      .max(MAX_PRICE, { error: "invalid" }),
  })
  .superRefine((coupon, ctx) => {
    const max = coupon.type === "PERCENT" ? 90 : MAX_PRICE;
    if (coupon.value < 1 || coupon.value > max) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "valueInvalid" });
    }
    if (coupon.startsAt && coupon.endsAt && coupon.endsAt <= coupon.startsAt) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "datesInvalid" });
    }
  });

export type CouponInput = z.infer<typeof couponSchema>;
