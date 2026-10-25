import { NextResponse } from "next/server";
import { approveAndVerifyPatch, getInvestigation, proposeDemoPatch, revertPatch, runAiReview, runControlledWorkflow, runDemoInvestigation } from "@/lib/investigations";
import { runExclusive } from "@/lib/lock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getInvestigation());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load investigation." }, { status: 500 });
  }
}

/** Mutating actions are serialized per server process so the JSON store and
 * child test processes are never touched by two requests at once. GET stays
 * lock-free because it only reads. */
export async function POST(request: Request) {
  try {
    const body = await request.json() as { action?: string; patchId?: string };
    const action = body.action;
    if (action === "run-demo") return NextResponse.json(await runExclusive("run-demo", runDemoInvestigation));
    if (action === "run-workflow") return NextResponse.json(await runExclusive("run-workflow", runControlledWorkflow));
    if (action === "ai-review") return NextResponse.json(await runExclusive("ai-review", runAiReview));
    if (action === "propose-patch") return NextResponse.json(await runExclusive("propose-patch", proposeDemoPatch));
    if (action === "approve-patch" && typeof body.patchId === "string") return NextResponse.json(await runExclusive("approve-patch", () => approveAndVerifyPatch(body.patchId as string)));
    if (action === "revert-patch" && typeof body.patchId === "string") return NextResponse.json(await runExclusive("revert-patch", () => revertPatch(body.patchId as string)));
    return NextResponse.json({ error: "Unsupported investigation action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to run investigation." }, { status: error instanceof Error && error.name === "AiUnavailableError" ? 503 : 500 });
  }
}
