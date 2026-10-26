/**
 * Shared record shapes. These are documentation-only JSDoc typedefs; the
 * codebase is deliberately plain JavaScript, so the shapes live here instead
 * of in a TypeScript interface file.
 */

/** @typedef {"passed" | "failed" | "timeout" | "cancelled" | "infrastructure_error"} RunStatus */
/** @typedef {"run" | "comparison" | "analysis" | "environment" | "unknown"} EvidenceKind */
/** @typedef {"observed" | "unknown"} Certainty */
/** @typedef {"low" | "medium" | "high"} Confidence */
/** @typedef {"deterministic" | "ai"} HypothesisSource */
/** @typedef {"draft" | "reviewed" | "applied" | "rejected" | "reverted"} PatchStatus */

/** @typedef {import("./discovery.js").RunningFramework} RunningFramework */

/**
 * @typedef {object} Project
 * @property {string} id
 * @property {string} name
 * @property {string} root Absolute path on this machine.
 * @property {boolean} trusted Explicitly confirmed by a human.
 * @property {RunningFramework} framework
 * @property {string[]} testFiles
 * @property {string} createdAt
 */

/**
 * @typedef {object} IndividualTestResult
 * @property {string} name
 * @property {"passed" | "failed" | "skipped" | "unknown"} status
 * @property {number} [durationMs]
 * @property {string} [error]
 */

/**
 * @typedef {object} TestRun
 * @property {string} id
 * @property {string} projectId
 * @property {string} investigationId
 * @property {string} label
 * @property {RunStatus} status
 * @property {string[]} command
 * @property {string} workingDirectory
 * @property {string} startedAt
 * @property {string} finishedAt
 * @property {number} durationMs
 * @property {number | null} exitCode
 * @property {string} stdout
 * @property {string} stderr
 * @property {IndividualTestResult[]} tests
 * @property {Record<string, string>} environment
 * @property {{ label: string, argv: string[], cwd: string }} spec Command spec used to re-run this run after a patch.
 */

/**
 * Run shape safe to send to the browser: raw output stays on the server.
 * @typedef {object} PublicTestRun
 * @property {string} id
 * @property {string} projectId
 * @property {string} label
 * @property {RunStatus} status
 * @property {string[]} command
 * @property {string} workingDirectory
 * @property {string} startedAt
 * @property {string} finishedAt
 * @property {number} durationMs
 * @property {number | null} exitCode
 * @property {IndividualTestResult[]} tests
 * @property {Record<string, string>} environment
 * @property {{ label: string, argv: string[], cwd: string }} spec
 * @property {number} stdoutBytes
 * @property {number} stderrBytes
 */

/**
 * @typedef {object} Evidence
 * @property {string} id
 * @property {string} investigationId
 * @property {EvidenceKind} kind
 * @property {string} statement
 * @property {string[]} sourceRunIds
 * @property {string[]} [sourceEvidenceIds]
 * @property {boolean} observed
 * @property {string} createdAt
 */

/**
 * @typedef {object} ComparisonFinding
 * @property {"status" | "order" | "error" | "command" | "duration" | "state" | "analysis"} category
 * @property {string} statement
 * @property {string[]} evidenceIds
 * @property {Certainty} certainty
 */

/**
 * @typedef {object} RunComparison
 * @property {string} id
 * @property {string} investigationId
 * @property {string} leftRunId
 * @property {string} rightRunId
 * @property {ComparisonFinding[]} findings
 * @property {string} createdAt
 */

/**
 * @typedef {object} StateFinding
 * @property {string} id
 * @property {string} investigationId
 * @property {string} kind
 * @property {string} file Project-relative path of the inspected file.
 * @property {number} line 1-based line number.
 * @property {string} snippet
 * @property {string} statement
 * @property {Certainty} certainty
 */

/**
 * @typedef {object} Hypothesis
 * @property {string} id
 * @property {string} investigationId
 * @property {HypothesisSource} [source]
 * @property {string} description
 * @property {string[]} supportingEvidenceIds
 * @property {string[]} contradictingEvidenceIds
 * @property {Confidence} confidence
 * @property {string} confidenceJustification
 * @property {string[]} alternativeExplanations
 * @property {string} nextExperiment
 * @property {string | null} experimentOutcome
 * @property {string} createdAt
 */

/**
 * @typedef {object} AgentToolInvocation
 * @property {string} id
 * @property {string} investigationId
 * @property {string} tool
 * @property {Record<string, unknown>} arguments
 * @property {"requested" | "completed" | "rejected" | "failed"} status
 * @property {string} result
 * @property {string} createdAt
 */

/**
 * @typedef {object} ProposedPatch
 * @property {string} id
 * @property {string} investigationId
 * @property {string} description
 * @property {string} diff
 * @property {PatchStatus} status
 * @property {string} baseline Honor-system description plus content hash.
 * @property {string} targetPath Project-relative primary target file.
 * @property {Array<{ targetPath: string, originalContent: string, appliedContent: string }>} edits
 *   Server-only exact before/after contents per edited file.
 */

/**
 * Patch shape safe to send to the browser.
 * @typedef {object} PublicPatch
 * @property {string} id
 * @property {string} investigationId
 * @property {string} description
 * @property {string} diff
 * @property {PatchStatus} status
 * @property {string} baseline
 * @property {string} targetPath
 */

/**
 * @typedef {object} VerificationResult
 * @property {string} id
 * @property {string} investigationId
 * @property {string} runId
 * @property {"verified" | "not_verified" | "unknown"} result
 * @property {string} notes
 */

/**
 * @typedef {object} InvestigationTarget
 * @property {string} testFile
 * @property {string | null} targetTest
 * @property {string | null} predecessorTest
 * @property {string} reasoning
 */

/**
 * @typedef {object} Investigation
 * @property {string} id
 * @property {string} projectId
 * @property {string} title
 * @property {"needs_review" | "verified" | "open"} status
 * @property {string} goal
 * @property {InvestigationTarget | null} target
 * @property {string[]} runIds
 * @property {string[]} evidenceIds
 * @property {string[]} hypothesisIds
 * @property {string[]} comparisonIds
 * @property {string[]} patchIds
 * @property {string[]} verificationIds
 * @property {string[]} analysisIds
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {object} StoredData
 * @property {Project[]} projects
 * @property {Investigation[]} investigations
 * @property {TestRun[]} runs
 * @property {Evidence[]} evidence
 * @property {RunComparison[]} comparisons
 * @property {StateFinding[]} analyses
 * @property {Hypothesis[]} hypotheses
 * @property {ProposedPatch[]} patches
 * @property {VerificationResult[]} verifications
 * @property {AgentToolInvocation[]} toolInvocations
 */

/**
 * @typedef {object} InvestigationSnapshot
 * @property {Investigation} investigation
 * @property {Project | null} project
 * @property {PublicTestRun[]} runs
 * @property {Evidence[]} evidence
 * @property {RunComparison[]} comparisons
 * @property {StateFinding[]} analyses
 * @property {Hypothesis[]} hypotheses
 * @property {AgentToolInvocation[]} toolInvocations
 * @property {PublicPatch[]} patches
 * @property {VerificationResult[]} verifications
 */

export {};
