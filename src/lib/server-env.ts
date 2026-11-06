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
  });
}
