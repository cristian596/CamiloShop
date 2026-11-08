/**
 * Wompi integrity signature and event checksum (docs.wompi.co, "Widget & Checkout
 * Web" and "Eventos"). Web Crypto only, so it runs on Workers and in Node tests.
 */

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison of two hex strings (case-insensitive). */
export function safeEqualHex(a: string, b: string): boolean {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index++) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return diff === 0;
}

/**
 * SHA256(reference + amountInCents + currency [+ expirationTime] + integritySecret).
 * Computed on the server only: the integrity secret never reaches the browser.
 */
export function integritySignature(input: {
  reference: string;
  amountInCents: number;
  currency: "COP";
  expirationTime?: string;
  secret: string;
}): Promise<string> {
  return sha256Hex(
    `${input.reference}${input.amountInCents}${input.currency}${input.expirationTime ?? ""}${input.secret}`,
  );
}

export interface WompiEvent {
  event: string;
  data: Record<string, unknown>;
  environment?: string;
  signature: { properties: string[]; checksum: string };
  timestamp: number;
  sent_at?: string;
}

function valueAt(data: Record<string, unknown>, path: string): string {
  const value = path
    .split(".")
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined,
      data,
    );
  return value === undefined || value === null ? "" : String(value);
}

/**
 * SHA256(values of signature.properties (paths inside `data`) + timestamp + eventsSecret).
 * The property list is read from the event itself, as Wompi may change it.
 */
export function eventChecksum(event: WompiEvent, secret: string): Promise<string> {
  const values = event.signature.properties.map((path) => valueAt(event.data, path)).join("");
  return sha256Hex(`${values}${event.timestamp}${secret}`);
}

export async function verifyEventChecksum(
  event: WompiEvent,
  received: string | null | undefined,
  secret: string,
): Promise<boolean> {
  if (!received || !Array.isArray(event.signature?.properties)) return false;
  return safeEqualHex(await eventChecksum(event, secret), received);
}
