import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { runInBackground } from "@/lib/background";
import { getDb } from "@/lib/db";
import { getWompiConfig } from "@/lib/server-env";
import { fetchWompiTransaction } from "@/lib/wompi/client";
import { verifyEventChecksum, type WompiEvent } from "@/lib/wompi/signature";
import { applyWompiTransaction } from "@/features/payments/apply-transaction";
import { sendOrderStatusEmail } from "@/features/orders/emails";

export const dynamic = "force-dynamic";

const ok = (body: Record<string, unknown> = { received: true }) =>
  NextResponse.json(body, { status: 200 });

/**
 * Wompi event endpoint. The order is changed only here (and by re-reading the
 * same transaction from the API on the order page), never by the redirect URL:
 * 1. Verify X-Event-Checksum against the raw event (401 if wrong).
 * 2. Record the event by a unique key; an already processed event returns 200.
 * 3. Re-read the transaction from the Wompi API and apply that, not the payload.
 * 4. Answer 200 quickly; emails run after the response.
 * A non-200 answer makes Wompi retry (30 min, 3 h, 24 h), so transient failures return 500.
 */
export async function POST(request: NextRequest) {
  const config = getWompiConfig();
  if (!config) return NextResponse.json({ error: "not configured" }, { status: 503 });

  let event: WompiEvent;
  try {
    event = JSON.parse(await request.text()) as WompiEvent;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!event?.signature || typeof event.timestamp !== "number" || !event.data) {
    return NextResponse.json({ error: "invalid event" }, { status: 400 });
  }

  const checksum = request.headers.get("x-event-checksum") ?? event.signature.checksum;
  if (!(await verifyEventChecksum(event, checksum, config.eventsSecret))) {
    return NextResponse.json({ error: "invalid checksum" }, { status: 401 });
  }

  // Signed but not for us: sandbox keys ignore production events and vice versa.
  if (event.environment && event.environment !== config.environment) return ok({ ignored: true });
  if (event.event !== "transaction.updated") return ok({ ignored: true });

  const transaction = event.data.transaction as { id?: unknown; status?: unknown } | undefined;
  if (typeof transaction?.id !== "string") {
    return NextResponse.json({ error: "missing transaction" }, { status: 400 });
  }

  const db = getDb();
  const eventKey = `${transaction.id}:${String(transaction.status)}:${event.timestamp}`;
  try {
    await db.webhookEvent.create({
      data: { provider: "WOMPI", eventKey, payload: event as unknown as Prisma.InputJsonValue },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"))
      throw error;
    const existing = await db.webhookEvent.findUnique({ where: { eventKey } });
    if (existing?.processedAt) return ok({ duplicate: true });
    // Recorded but not processed (an earlier attempt failed): process it again.
  }

  const fresh = await fetchWompiTransaction(config, transaction.id);
  if (!fresh) return NextResponse.json({ error: "transaction lookup failed" }, { status: 500 });

  const result = await applyWompiTransaction(db, fresh);
  await db.webhookEvent.update({ where: { eventKey }, data: { processedAt: new Date() } });

  if (result.outcome === "paid" && result.orderId) {
    runInBackground("order paid email", sendOrderStatusEmail(result.orderId, "PAID"));
  }
  return ok({ outcome: result.outcome });
}
