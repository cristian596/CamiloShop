import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { getPaymentGateway } = await import("@/lib/server-env");

const WOMPI_KEYS = {
  WOMPI_PUBLIC_KEY: "pub_test_x",
  WOMPI_PRIVATE_KEY: "prv_test_x",
  WOMPI_INTEGRITY_SECRET: "test_integrity_x",
  WOMPI_EVENTS_SECRET: "test_events_x",
};

function withEnv(values: Record<string, string>) {
  for (const key of ["PAYMENT_GATEWAY", ...Object.keys(WOMPI_KEYS)]) vi.stubEnv(key, "");
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
}

describe("getPaymentGateway", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("falls back to the simulated gateway when there are no Wompi keys", () => {
    withEnv({});
    expect(getPaymentGateway()).toBe("simulated");
  });

  it("uses Wompi when all its keys are present", () => {
    withEnv(WOMPI_KEYS);
    expect(getPaymentGateway()).toBe("wompi");
  });

  it("can force the simulated gateway even with Wompi keys", () => {
    withEnv({ ...WOMPI_KEYS, PAYMENT_GATEWAY: "simulated" });
    expect(getPaymentGateway()).toBe("simulated");
  });

  it("turns online payments off when Wompi is required but unconfigured", () => {
    withEnv({ PAYMENT_GATEWAY: "wompi", WOMPI_PUBLIC_KEY: "pub_test_x" });
    expect(getPaymentGateway()).toBeNull();
  });
});
