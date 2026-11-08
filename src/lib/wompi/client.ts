import { z } from "zod";

export const WOMPI_CHECKOUT_URL = "https://checkout.wompi.co/p/";

export const WOMPI_STATUSES = ["PENDING", "APPROVED", "DECLINED", "VOIDED", "ERROR"] as const;

export const wompiTransactionSchema = z.object({
  id: z.string().min(1),
  reference: z.string().min(1),
  status: z.enum(WOMPI_STATUSES),
  amount_in_cents: z.number().int(),
  currency: z.string(),
  payment_method_type: z.string().nullish(),
  status_message: z.string().nullish(),
});

export type WompiTransaction = z.infer<typeof wompiTransactionSchema>;

/**
 * Reads a transaction from the Wompi API. Webhooks and redirects only tell us
 * *which* transaction changed; its real status always comes from here.
 * Returns null when Wompi does not know it or does not answer.
 */
export async function fetchWompiTransaction(
  config: { apiUrl: string; privateKey: string },
  id: string,
): Promise<WompiTransaction | null> {
  if (!/^[\w-]{1,64}$/.test(id)) return null;
  try {
    const response = await fetch(`${config.apiUrl}/transactions/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${config.privateKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("[wompi] transaction lookup failed", response.status, id);
      return null;
    }
    const body = (await response.json()) as { data?: unknown };
    const parsed = wompiTransactionSchema.safeParse(body.data);
    if (!parsed.success) {
      console.error("[wompi] unexpected transaction shape", id, parsed.error.issues[0]);
      return null;
    }
    return parsed.data;
  } catch (error) {
    console.error("[wompi] transaction lookup error", id, error);
    return null;
  }
}
