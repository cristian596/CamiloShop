import { describe, expect, it } from "vitest";
import {
  eventChecksum,
  integritySignature,
  safeEqualHex,
  verifyEventChecksum,
  type WompiEvent,
} from "@/lib/wompi/signature";

// Vectors copied from the Wompi documentation (docs.wompi.co).
describe("Wompi integrity signature", () => {
  it("matches the documented example", async () => {
    await expect(
      integritySignature({
        reference: "sk8-438k4-xmxm392-sn2m",
        amountInCents: 2490000,
        currency: "COP",
        secret: "prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6",
      }),
    ).resolves.toBe("37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5");
  });

  it("includes the expiration time when present", async () => {
    const base = { reference: "R1", amountInCents: 100, currency: "COP" as const, secret: "s" };
    const withExpiry = await integritySignature({
      ...base,
      expirationTime: "2026-11-07T20:00:00.000Z",
    });
    expect(withExpiry).not.toBe(await integritySignature(base));
  });
});

describe("Wompi event checksum", () => {
  const event: WompiEvent = {
    event: "transaction.updated",
    data: {
      transaction: {
        id: "1234-1610641025-49201",
        amount_in_cents: 4490000,
        reference: "MZQ3X2DE2SMX",
        currency: "COP",
        status: "APPROVED",
      },
    },
    environment: "prod",
    signature: {
      properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
      checksum: "3476DDA50F64CD7CBD160689640506FEBEA93239BC524FC0469B2C68A3CC8BD0",
    },
    timestamp: 1530291411,
  };
  const secret = "prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z";

  // The docs show the concatenation step by step:
  // "1234-1610641025-49201APPROVED44900001530291411prod_events_…". Its real SHA-256 is
  // 5A18EC5E…; the checksum printed next to it (3476DDA5…) does not match its own
  // string, so it is illustrative. We assert the documented concatenation instead.
  const documentedHash = "5A18EC5E8FDB7DF463E9F94774CBA8F583BA21BD04A09CEFF2EA68A4BC0AEFBE";

  it("hashes the documented concatenation", async () => {
    expect((await eventChecksum(event, secret)).toUpperCase()).toBe(documentedHash);
    await expect(verifyEventChecksum(event, documentedHash, secret)).resolves.toBe(true);
  });

  it("rejects a tampered event, a wrong secret or a missing checksum", async () => {
    const tampered = structuredClone(event);
    (tampered.data.transaction as { status: string }).status = "DECLINED";
    await expect(verifyEventChecksum(tampered, documentedHash, secret)).resolves.toBe(false);
    await expect(verifyEventChecksum(event, documentedHash, "wrong")).resolves.toBe(false);
    await expect(verifyEventChecksum(event, null, secret)).resolves.toBe(false);
  });

  it("compares hex in constant time, ignoring case", () => {
    expect(safeEqualHex("abc123", "ABC123")).toBe(true);
    expect(safeEqualHex("abc123", "abc124")).toBe(false);
    expect(safeEqualHex("abc", "abc1")).toBe(false);
  });
});
