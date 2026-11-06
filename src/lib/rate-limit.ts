import "server-only";
import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/server-env";

export interface RateLimitRule {
  action: string;
  limit: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  demoLogin: { action: "demo-login", limit: 10, windowMs: 10 * 60_000 },
  register: { action: "register", limit: 5, windowMs: 60 * 60_000 },
} satisfies Record<string, RateLimitRule>;

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Salted SHA-256 of the client IP. The plain IP is never stored. Cloudflare sets
 * CF-Connecting-IP; x-forwarded-for is only a local-development fallback.
 */
export async function clientIpKey(): Promise<string> {
  const requestHeaders = await headers();
  const ip =
    requestHeaders.get("cf-connecting-ip") ??
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  let salt = getServerEnv().RATE_LIMIT_SALT;
  if (!salt) {
    console.warn("[rate-limit] RATE_LIMIT_SALT is not set; using a development salt");
    salt = "camiloshop-development-salt";
  }
  return `ip:${await sha256Hex(`${salt}:${ip}`)}`;
}

/**
 * Records one attempt and reports whether it is within the limit. Counting in
 * Postgres works across Worker isolates, unlike in-memory counters. Two requests
 * racing at the edge of the window can both pass; that is acceptable here.
 */
export async function consumeRateLimit(key: string, rule: RateLimitRule): Promise<boolean> {
  const db = getDb();
  const since = new Date(Date.now() - rule.windowMs);
  const recent = await db.rateLimitHit.count({
    where: { key, action: rule.action, createdAt: { gte: since } },
  });
  if (recent >= rule.limit) return false;

  await db.rateLimitHit.create({ data: { key, action: rule.action } });
  return true;
}
