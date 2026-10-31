import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness check used by the keep-alive workflow and the phase 1 infrastructure spike. */
export async function GET() {
  const startedAt = Date.now();

  try {
    const db = getDb();
    await db.$queryRaw`SELECT 1`;
    getCloudflareContext().ctx.waitUntil(db.$disconnect());

    return NextResponse.json(
      { status: "ok", db: "ok", latencyMs: Date.now() - startedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // Log details server-side only; the response never exposes connection info.
    console.error("[health] database check failed", error);
    return NextResponse.json(
      { status: "degraded", db: "error", latencyMs: Date.now() - startedAt },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
