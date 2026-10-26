import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { listProjectsAction, registerProjectAction } from "@/lib/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lists registered projects with their discovery metadata.
 * @returns {Promise<NextResponse>}
 */
export async function GET() {
  try {
    return NextResponse.json({ projects: await listProjectsAction() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list projects." },
      { status: error instanceof AppError ? error.status : 500 },
    );
  }
}

/**
 * Registers a local directory as a project. `trusted` must be explicitly
 * confirmed in the same request; registration never executes anything.
 * @param {Request} request
 * @returns {Promise<NextResponse>}
 */
export async function POST(request) {
  try {
    const body = /** @type {{ root?: unknown, trusted?: unknown }} */ (await request.json());
    if (typeof body.root !== "string") {
      return NextResponse.json({ error: "A root path string is required." }, { status: 400 });
    }
    const result = await registerProjectAction(body.root, body.trusted === true);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to register project." },
      { status: error instanceof AppError ? error.status : 500 },
    );
  }
}
