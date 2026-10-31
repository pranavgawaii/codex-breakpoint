import { NextResponse } from "next/server";
import { proxyToEngine } from "../engine-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lists registered projects (engine-owned).
 * @returns {Promise<NextResponse>}
 */
import { BUNDLED_SAMPLE_PROJECTS } from "../../lib/sample-data";

export async function GET() {
  const response = await proxyToEngine("/api/projects", { method: "GET" }, "Unable to list projects.");
  if (response.status === 502) {
    return NextResponse.json({ projects: BUNDLED_SAMPLE_PROJECTS, offline: true });
  }
  return response;
}

/**
 * Registers a local directory as a project. `trusted` must be explicitly
 * confirmed in the same request; registration never executes anything.
 * @param {Request} request
 * @returns {Promise<NextResponse>}
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A JSON body with a root path is required." }, { status: 400 });
  }
  return proxyToEngine("/api/projects", { method: "POST", body: JSON.stringify(body) }, "Unable to register the project.");
}
