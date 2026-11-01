import { NextResponse } from "next/server";
import { proxyToEngine } from "../engine-client";
import { SAMPLE_INVESTIGATION_SNAPSHOT } from "../../lib/sample-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the active investigation snapshot (engine-owned).
 * If the engine is offline, returns the bundled sample snapshot with offline flag.
 * @returns {Promise<NextResponse>}
 */
export async function GET() {
  const response = await proxyToEngine("/api/investigations", { method: "GET" }, "Unable to load the investigation.");
  if (response.status === 502) {
    return NextResponse.json({ ...SAMPLE_INVESTIGATION_SNAPSHOT, offline: true });
  }
  return response;
}

/**
 * Action dispatch — the engine owns every investigation action:
 * run-demo, run-workflow, scan-project, start-investigation, ai-review,
 * propose-patch, approve-patch, revert-patch.
 * @param {Request} request
 * @returns {Promise<NextResponse>}
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  return proxyToEngine("/api/investigations", { method: "POST", body: JSON.stringify(body) }, "Unable to run the investigation action.");
}
