import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaPg } from "@prisma/adapter-pg";
import { cache } from "react";
import { PrismaClient } from "@prisma/client";

function resolveConnectionString(): string {
  const { env } = getCloudflareContext();
  // In production the HYPERDRIVE binding provides a pooled connection string.
  // Locally, wrangler fills it from CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE.
  const connectionString = env.HYPERDRIVE?.connectionString || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("No database connection string: configure HYPERDRIVE or DATABASE_URL");
  }
  return connectionString;
}

/**
 * Returns a Prisma client scoped to the current request.
 *
 * Workers cannot reuse TCP connections across requests, so a global client would
 * break later requests. `maxUses: 1` keeps pg from recycling connections, and
 * React's `cache` dedupes the client within a single server render.
 */
export const getDb = cache((): PrismaClient => {
  const adapter = new PrismaPg({ connectionString: resolveConnectionString(), maxUses: 1 });
  return new PrismaClient({ adapter });
});
