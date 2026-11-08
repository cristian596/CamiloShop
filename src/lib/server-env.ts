import "server-only";
import { z } from "zod";

const booleanFlag = z
  .enum(["true", "false"])
  .default("true")
  .transform((value) => value === "true");

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).default("CamiloShop <onboarding@resend.dev>"),
  REQUIRE_EMAIL_VERIFICATION: booleanFlag,
  RATE_LIMIT_SALT: z.string().min(16).optional(),
  DEMO_USER_EMAIL: z.email().optional(),
  DEMO_USER_PASSWORD: z.string().min(8).optional(),
  /** Minutes an unpaid card/PSE order keeps its stock reserved. */
  ORDER_EXPIRY_MINUTES: z.coerce.number().int().positive().default(30),
  /** Minutes a cash-on-delivery order waits for admin confirmation. */
  COD_ORDER_EXPIRY_MINUTES: z.coerce.number().int().positive().default(2880),
  /**
   * Gateway for card/PSE: "wompi" (real sandbox, needs the four keys) or
   * "simulated" (built-in demo gateway, no money involved). Unset: Wompi when
   * its keys exist, otherwise the simulated gateway.
   */
  PAYMENT_GATEWAY: z.enum(["wompi", "simulated"]).optional(),
  /** Wompi (sandbox: pub_test_ / prv_test_ / test_integrity_ / test_events_). */
  WOMPI_PUBLIC_KEY: z.string().startsWith("pub_").optional(),
  WOMPI_PRIVATE_KEY: z.string().startsWith("prv_").optional(),
  WOMPI_INTEGRITY_SECRET: z.string().min(1).optional(),
  WOMPI_EVENTS_SECRET: z.string().min(1).optional(),
  WOMPI_API_URL: z.url().default("https://sandbox.wompi.co/v1"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

/**
 * Server-only settings, read lazily: on Cloudflare, secrets reach process.env per
 * request (nodejs_compat), and `next build` must not require them.
 */
export function getServerEnv(): ServerEnv {
  return serverSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
    EMAIL_FROM: process.env.EMAIL_FROM || undefined,
    REQUIRE_EMAIL_VERIFICATION: process.env.REQUIRE_EMAIL_VERIFICATION || undefined,
    RATE_LIMIT_SALT: process.env.RATE_LIMIT_SALT || undefined,
    DEMO_USER_EMAIL: process.env.DEMO_USER_EMAIL || undefined,
    DEMO_USER_PASSWORD: process.env.DEMO_USER_PASSWORD || undefined,
    ORDER_EXPIRY_MINUTES: process.env.ORDER_EXPIRY_MINUTES || undefined,
    COD_ORDER_EXPIRY_MINUTES: process.env.COD_ORDER_EXPIRY_MINUTES || undefined,
    PAYMENT_GATEWAY: process.env.PAYMENT_GATEWAY || undefined,
    WOMPI_PUBLIC_KEY: process.env.WOMPI_PUBLIC_KEY || undefined,
    WOMPI_PRIVATE_KEY: process.env.WOMPI_PRIVATE_KEY || undefined,
    WOMPI_INTEGRITY_SECRET: process.env.WOMPI_INTEGRITY_SECRET || undefined,
    WOMPI_EVENTS_SECRET: process.env.WOMPI_EVENTS_SECRET || undefined,
    WOMPI_API_URL: process.env.WOMPI_API_URL || undefined,
  });
}

/** Card/PSE checkout needs every Wompi key; without them only cash on delivery is offered. */
export function getWompiConfig() {
  const env = getServerEnv();
  if (
    !env.WOMPI_PUBLIC_KEY ||
    !env.WOMPI_PRIVATE_KEY ||
    !env.WOMPI_INTEGRITY_SECRET ||
    !env.WOMPI_EVENTS_SECRET
  ) {
    return null;
  }
  return {
    publicKey: env.WOMPI_PUBLIC_KEY,
    privateKey: env.WOMPI_PRIVATE_KEY,
    integritySecret: env.WOMPI_INTEGRITY_SECRET,
    eventsSecret: env.WOMPI_EVENTS_SECRET,
    apiUrl: env.WOMPI_API_URL,
    /** Sandbox keys must never process production events, and vice versa. */
    environment: env.WOMPI_PUBLIC_KEY.startsWith("pub_test_") ? "test" : "prod",
  } as const;
}

export type WompiConfig = NonNullable<ReturnType<typeof getWompiConfig>>;

export type PaymentGateway = "wompi" | "simulated";

/**
 * Which gateway takes card/PSE payments, or null when online payments are off
 * (PAYMENT_GATEWAY=wompi without keys): then only cash on delivery is offered.
 */
export function getPaymentGateway(): PaymentGateway | null {
  const choice = getServerEnv().PAYMENT_GATEWAY;
  if (choice === "simulated") return "simulated";
  if (getWompiConfig()) return "wompi";
  return choice === "wompi" ? null : "simulated";
}
