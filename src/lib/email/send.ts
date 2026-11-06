import "server-only";
import { getServerEnv } from "@/lib/server-env";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendEmailResult = { ok: true; id: string } | { ok: false; reason: string };

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Sends one email through the Resend API. It never throws: failures are logged
 * and returned, so sign-up, orders and status changes always complete.
 * Without a verified domain, Resend (onboarding@resend.dev) only delivers to the
 * account owner's address; other recipients fail here and are logged.
 */
export async function sendEmail(message: EmailMessage): Promise<SendEmailResult> {
  try {
    const { RESEND_API_KEY, EMAIL_FROM } = getServerEnv();
    if (!RESEND_API_KEY) {
      console.warn("[email] RESEND_API_KEY is not set; skipping", { subject: message.subject });
      return { ok: false, reason: "not-configured" };
    }

    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, ...message }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[email] Resend rejected the message", response.status, detail.slice(0, 500));
      return { ok: false, reason: `http-${response.status}` };
    }

    const { id } = (await response.json()) as { id: string };
    return { ok: true, id };
  } catch (error) {
    console.error("[email] sending failed", error);
    return { ok: false, reason: "exception" };
  }
}
