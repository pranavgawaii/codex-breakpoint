import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Base URL of the Breakpoint engine service (Python, `breakpoint serve`). */
export const ENGINE_URL = process.env.BREAKPOINT_ENGINE_URL || "http://127.0.0.1:8000";

/** Default timeout in milliseconds for proxying requests to the engine service. */
export const ENGINE_TIMEOUT_MS = parseInt(process.env.BREAKPOINT_TIMEOUT_MS || "12000", 10);

/**
 * Forwards a request to the engine and relays its JSON response and status.
 * The web app is a thin client: the engine owns all investigation logic.
 * @param {string} path Engine API path.
 * @param {RequestInit} [init] Fetch options (body already serialized).
 * @param {string} [errorMessage] Fallback message when the engine is unreachable.
 * @returns {Promise<NextResponse>}
 */
export async function proxyToEngine(path, init, errorMessage = "Breakpoint engine is unreachable.") {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ENGINE_TIMEOUT_MS);

  try {
    const response = await fetch(`${ENGINE_URL}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers || {}) },
      cache: "no-store",
      signal: init?.signal || controller.signal,
    });
    clearTimeout(timeoutId);

    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text.slice(0, 300) || errorMessage };
    }
    return NextResponse.json(payload, { status: response.status });
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err?.name === "AbortError";
    return NextResponse.json(
      {
        error: isTimeout
          ? `Breakpoint engine timed out after ${ENGINE_TIMEOUT_MS}ms at ${ENGINE_URL}.`
          : "Breakpoint engine is unreachable. Start it with `breakpoint serve` (engine/) and set BREAKPOINT_ENGINE_URL if it is not on 127.0.0.1:8000.",
        code: isTimeout ? "ENGINE_TIMEOUT" : "ENGINE_UNREACHABLE",
        engineUrl: ENGINE_URL,
      },
      { status: 502 },
    );
  }
}
