import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Base URL of the Breakpoint engine service (Python, `breakpoint serve`). */
export const ENGINE_URL = process.env.BREAKPOINT_ENGINE_URL || "http://127.0.0.1:8000";

/**
 * Forwards a request to the engine and relays its JSON response and status.
 * The web app is a thin client: the engine owns all investigation logic.
 * @param {string} path Engine API path.
 * @param {RequestInit} [init] Fetch options (body already serialized).
 * @param {string} [errorMessage] Fallback message when the engine is unreachable.
 * @returns {Promise<NextResponse>}
 */
export async function proxyToEngine(path, init, errorMessage = "Breakpoint engine is unreachable.") {
  try {
    const response = await fetch(`${ENGINE_URL}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers || {}) },
      cache: "no-store",
    });
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text.slice(0, 300) || errorMessage };
    }
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      {
        error:
          "Breakpoint engine is unreachable. Start it with `breakpoint serve` (engine/) and set BREAKPOINT_ENGINE_URL if it is not on 127.0.0.1:8000.",
      },
      { status: 502 },
    );
  }
}
