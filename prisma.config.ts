import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer loads env files automatically; Next.js uses .env.local.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // Migrations need a direct (session) connection, never the transaction pooler.
    url: process.env.DIRECT_URL ?? "",
  },
});
