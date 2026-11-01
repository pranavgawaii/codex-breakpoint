import { NextResponse } from "next/server";
import { proxyToEngine, ENGINE_URL } from "../engine-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health check endpoint reporting Next.js server status and Python engine connectivity.
 * @returns {Promise<NextResponse>}
 */
export async function GET() {
  const start = Date.now();
  try {
    const response = await proxyToEngine("/api/health", { method: "GET" }, "Engine unreachable.");
    const latencyMs = Date.now() - start;

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        ok: true,
        web: "online",
        engine: "online",
        engineDetails: data,
        engineUrl: ENGINE_URL,
        latencyMs,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      ok: true,
      web: "online",
      engine: "offline",
      engineUrl: ENGINE_URL,
      latencyMs,
      mode: "simulation",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      ok: true,
      web: "online",
      engine: "offline",
      engineUrl: ENGINE_URL,
      latencyMs: Date.now() - start,
      mode: "simulation",
      timestamp: new Date().toISOString(),
    });
  }
}
