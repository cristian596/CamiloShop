import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness check used by the keep-alive workflow (it also keeps Supabase awake). */
export async function GET() {
  const startedAt = Date.now();

  try {
    await getDb().$queryRaw`SELECT 1`;

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
