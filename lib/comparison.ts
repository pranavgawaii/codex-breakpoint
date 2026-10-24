import type { ComparisonFinding, Evidence, TestRun } from "./models";

export function compareRuns(failing: TestRun, passing: TestRun, evidence: Evidence[]): ComparisonFinding[] {
  const source = (runId: string) => evidence.find((item) => item.sourceRunIds.includes(runId))?.id ?? "unknown";
  const findings: ComparisonFinding[] = [];
  if (failing.status !== passing.status || failing.exitCode !== passing.exitCode) findings.push({ category: "status", statement: `Run ${failing.id} ${failing.status} (exit ${failing.exitCode}); run ${passing.id} ${passing.status} (exit ${passing.exitCode}).`, evidenceIds: [source(failing.id), source(passing.id)], certainty: "observed" });
  const failingNames = failing.tests.map((test) => test.name).join(" → ");
  const passingNames = passing.tests.map((test) => test.name).join(" → ");
  if (failingNames !== passingNames) findings.push({ category: "order", statement: `Recorded test result order differs: failing run ${failingNames || "unavailable"}; passing run ${passingNames || "unavailable"}.`, evidenceIds: [source(failing.id), source(passing.id)], certainty: "observed" });
  const failed = failing.tests.find((test) => test.status === "failed");
  if (failed) findings.push({ category: "error", statement: `Failing run records test failure: ${failed.name}${failed.error ? ` — ${failed.error}` : ""}.`, evidenceIds: [source(failing.id)], certainty: "observed" });
  if (failing.command.join(" ") !== passing.command.join(" ")) findings.push({ category: "command", statement: "The recorded commands differ between runs.", evidenceIds: [source(failing.id), source(passing.id)], certainty: "observed" });
  findings.push({ category: "duration", statement: `Recorded durations: ${failing.durationMs} ms vs ${passing.durationMs} ms.`, evidenceIds: [source(failing.id), source(passing.id)], certainty: "observed" });
  findings.push({ category: "state", statement: "No application-state capture was configured for these runs; any state transition is unknown.", evidenceIds: [source(failing.id), source(passing.id)], certainty: "unknown" });
  return findings;
}
