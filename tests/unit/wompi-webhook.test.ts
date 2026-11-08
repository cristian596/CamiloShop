import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eventChecksum, type WompiEvent } from "@/lib/wompi/signature";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  fetchTransaction: vi.fn(),
  apply: vi.fn(),
  sendStatusEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server-env", () => ({
  getWompiConfig: () => ({
    publicKey: "pub_test_x",
    privateKey: "prv_test_x",
    integritySecret: "test_integrity_x",
    eventsSecret: "test_events_secret",
    apiUrl: "https://sandbox.wompi.co/v1",
    environment: "test",
  }),
}));
vi.mock("@/lib/db", () => ({
  getDb: () => ({
    webhookEvent: { create: mocks.create, findUnique: mocks.findUnique, update: mocks.update },
  }),
}));
vi.mock("@/lib/wompi/client", () => ({ fetchWompiTransaction: mocks.fetchTransaction }));
vi.mock("@/features/payments/apply-transaction", () => ({ applyWompiTransaction: mocks.apply }));
vi.mock("@/features/orders/emails", () => ({ sendOrderStatusEmail: mocks.sendStatusEmail }));
vi.mock("@/lib/background", () => ({
  runInBackground: (_label: string, work: Promise<unknown>) => void work,
}));

const { POST } = await import("@/app/api/webhooks/wompi/route");

const SECRET = "test_events_secret";

async function signedEvent(status = "APPROVED", environment = "test") {
  const event: WompiEvent = {
    event: "transaction.updated",
    data: {
      transaction: { id: "tx-1", reference: "CS-2026-000001-A1", status, amount_in_cents: 100 },
    },
    environment,
    signature: {
      properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
      checksum: "",
    },
    timestamp: 1_800_000_000,
  };
  event.signature.checksum = await eventChecksum(event, SECRET);
  return event;
}

function post(event: WompiEvent, checksum = event.signature.checksum) {
  return POST(
    new NextRequest("https://shop.example/api/webhooks/wompi", {
      method: "POST",
      body: JSON.stringify(event),
      headers: { "x-event-checksum": checksum },
    }),
  );
}

const apiTransaction = {
  id: "tx-1",
  reference: "CS-2026-000001-A1",
  status: "APPROVED",
  amount_in_cents: 100,
  currency: "COP",
};

describe("Wompi webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({});
    mocks.update.mockResolvedValue({});
    mocks.fetchTransaction.mockResolvedValue(apiTransaction);
    mocks.apply.mockResolvedValue({ outcome: "paid", orderId: "order-1" });
  });

  it("rejects an invalid checksum with 401 and touches nothing", async () => {
    const response = await post(await signedEvent(), "deadbeef");
    expect(response.status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it("applies the transaction read from the API, not the payload", async () => {
    // The payload says DECLINED, the API says APPROVED: the API wins.
    mocks.fetchTransaction.mockResolvedValue({ ...apiTransaction, status: "APPROVED" });
    const response = await post(await signedEvent("DECLINED"));
    expect(response.status).toBe(200);
    expect(mocks.fetchTransaction).toHaveBeenCalledWith(expect.anything(), "tx-1");
    expect(mocks.apply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "APPROVED" }),
    );
    expect(mocks.update).toHaveBeenCalled();
    expect(mocks.sendStatusEmail).toHaveBeenCalledWith("order-1", "PAID");
  });

  it("answers 200 without reprocessing an event it already processed", async () => {
    mocks.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    mocks.findUnique.mockResolvedValue({ processedAt: new Date() });
    const response = await post(await signedEvent());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ duplicate: true });
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it("ignores events from the other environment", async () => {
    const response = await post(await signedEvent("APPROVED", "prod"));
    expect(response.status).toBe(200);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("returns 500 so Wompi retries when the API cannot be reached", async () => {
    mocks.fetchTransaction.mockResolvedValue(null);
    const response = await post(await signedEvent());
    expect(response.status).toBe(500);
    expect(mocks.apply).not.toHaveBeenCalled();
  });
});
