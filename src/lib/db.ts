import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";

/*
 * One Prisma client per server instance. On Vercel (Fluid compute) an instance
 * serves many requests, so the pg pool is shared and reused; attachDatabasePool
 * closes idle connections before the instance is suspended, so they do not
 * leak. DATABASE_URL points at Supabase's transaction pooler (port 6543), which
 * multiplexes the connections of every instance onto a few Postgres backends.
 */

const POOL_SIZE = 5;

const globalForDb = globalThis as typeof globalThis & { camiloshopDb?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");

  const pool = new Pool({ connectionString, max: POOL_SIZE });
  // Outside Vercel (next dev, next start, tests) this is a no-op.
  attachDatabasePool(pool);
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

/** The shared Prisma client (also survives hot reloads in `next dev`). */
export function getDb(): PrismaClient {
  globalForDb.camiloshopDb ??= createClient();
  return globalForDb.camiloshopDb;
}
