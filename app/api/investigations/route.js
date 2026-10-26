import { NextResponse } from "next/server";
import { AiUnavailableError, AppError } from "@/lib/errors";
import { runExclusive } from "@/lib/lock";
import {
  approveAndVerifyPatch,
  getInvestigation,
  proposePatch,
  revertPatch,
  runAiReview,
  runControlledWorkflow,
  runDemoInvestigation,
  scanProject,
  startInvestigation,
} from "@/lib/investigations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Map thrown errors to explicit statuses. AppError carries its own status;
 * AiUnavailableError predates the hierarchy and maps to 503. */
function statusFor(error) {
  if (error instanceof AppError) return error.status;
  if (error instanceof AiUnavailableError) return 503;
  return 500;
}

export async function GET() {
  try {
    return NextResponse.json(await getInvestigation());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load investigation." },
      { status: 500 },
    );
  }
}

/** Mutating actions are serialized per server process so the JSON store and
 * child test processes are never touched by two requests at once. GET stays
 * lock-free because it only reads. */
export async function POST(request) {
  try {
    const body = /** @type {{ action?: string, patchId?: string, projectId?: string, testFile?: string, targetTest?: string, demoOnly?: boolean }} */ (
      await request.json()
    );
    const action = body.action;
    const demoOnly = body.demoOnly === true;
    if (action === "run-demo") return NextResponse.json(await runExclusive("run-demo", runDemoInvestigation));
    if (action === "run-workflow") {
      const filters = { testFile: body.testFile, targetTest: body.targetTest, demoOnly };
      return NextResponse.json(await runExclusive("run-workflow", () => runControlledWorkflow(filters)));
    }
    if (action === "scan-project") {
      return NextResponse.json(await runExclusive("scan-project", () => scanProject(typeof body.projectId === "string" ? body.projectId : undefined)));
    }
    if (action === "start-investigation" && typeof body.projectId === "string") {
      return NextResponse.json(await runExclusive("start-investigation", () => startInvestigation(body.projectId)));
    }
    if (action === "ai-review") return NextResponse.json(await runExclusive("ai-review", () => runAiReview(demoOnly)));
    if (action === "propose-patch") return NextResponse.json(await runExclusive("propose-patch", () => proposePatch(demoOnly)));
    if (action === "approve-patch" && typeof body.patchId === "string") {
      return NextResponse.json(await runExclusive("approve-patch", () => approveAndVerifyPatch(body.patchId, demoOnly)));
    }
    if (action === "revert-patch" && typeof body.patchId === "string") {
      return NextResponse.json(await runExclusive("revert-patch", () => revertPatch(body.patchId, demoOnly)));
    }
    return NextResponse.json({ error: "Unsupported investigation action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to run investigation." },
      { status: statusFor(error) },
    );
  }
}
