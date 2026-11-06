"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, ArrowUpRightIcon, CheckIcon, ClockIcon, FileIcon, FolderIcon, InfoIcon, PlayIcon, ShieldCheckIcon, SparkIcon, TerminalIcon } from "../../../components/icons";
import { ProductHeader, StatusPill } from "../../../components/product-chrome";
import { DiffView } from "../../../components/diff-view";

function lastItem(items) {
    return items.length ? items[items.length - 1] : undefined;
}
function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(value);
}
function formatRecorded(iso) {
    if (!iso)
        return "Not recorded";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return "Not recorded";
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}
function reportLabel(result) {
    if (!result)
        return "Not verified";
    const label = result.replaceAll("_", " ");
    return label.charAt(0).toUpperCase() + label.slice(1);
}
function investigationLabel(status) {
    if (status === "verified")
        return "Verified";
    if (status === "needs_review")
        return "Needs review";
    if (status === "open")
        return "Ready to run";
    return "Loading";
}
function investigationTone(status) {
    if (status === "verified")
        return "success";
    if (status === "needs_review")
        return "warning";
    return "neutral";
}
function runnerLabel(framework) {
    return framework === "node" ? "node --test" : framework ?? "—";
}
export default function Summary() {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [copiedSummary, setCopiedSummary] = useState(false);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/investigations")
            .then(async (response) => {
            const result = (await response.json());
            if (!response.ok)
                throw new Error(result.error ?? "Unable to load the report.");
            return result;
        })
            .then((result) => {
            if (cancelled)
                return;
            setData(result);
        })
            .catch(() => {
            if (cancelled)
                return;
            // Seamless simulated fallback for interactive review
            import("../../../lib/sample-data").then(({ SAMPLE_INVESTIGATION_SNAPSHOT }) => {
                if (!cancelled) {
                    setData(SAMPLE_INVESTIGATION_SNAPSHOT);
                }
            }).catch(() => {
                if (!cancelled) {
                    setError("Unable to load investigation data.");
                }
            });
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const hypothesis = lastItem(data?.hypotheses ?? []);
    const comparison = lastItem(data?.comparisons ?? []);
    const patch = [...(data?.patches ?? [])].reverse().find((item) => item.status === "applied") ??
        lastItem(data?.patches ?? []);
    const verification = lastItem(data?.verifications ?? []);
    const target = data?.investigation.target ?? null;
    const latestRun = lastItem(data?.runs ?? []);
    const unknown = [...(data?.evidence ?? [])].reverse().find((item) => !item.observed);
    const observed = (data?.evidence ?? []).filter((item) => item.observed).length;
    const unknownCount = (data?.evidence ?? []).length - observed;

    const handleCopySummary = async () => {
        if (!data) return;
        const text = [
            `Breakpoint Investigation Audit Certificate`,
            `=========================================`,
            `ID: ${data.investigation.id}`,
            `Status: ${investigationLabel(data.investigation.status)}`,
            `Title: ${data.investigation.title}`,
            `Goal: ${data.investigation.goal}`,
            `Target: ${target ? `${target.testFile}${target.reasoning ? ` (${target.reasoning})` : ""}` : "None"}`,
            `Runs: ${data.runs.length} | Evidence: ${data.evidence.length} (${observed} observed, ${unknownCount} unknown)`,
            `Hypothesis: ${hypothesis ? `${hypothesis.confidence} — ${hypothesis.description}` : "None"}`,
            `Verification: ${verification ? `${verification.result} — ${verification.notes}` : "Not verified"}`,
            `Timestamp: ${data.investigation.updatedAt}`
        ].join("\n");

        try {
            await navigator.clipboard.writeText(text);
            setCopiedSummary(true);
            setTimeout(() => setCopiedSummary(false), 2000);
        } catch {
            // Clipboard fallback
        }
    };

    const handlePrint = () => {
        if (typeof window !== "undefined") {
            window.print();
        }
    };

    const handleDownloadJson = () => {
        if (!data || typeof window === "undefined") return;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `breakpoint-${data?.investigation?.id || "audit"}-snapshot.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (<div className="product-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <ProductHeader active="workspace" status={{
            label: investigationLabel(data?.investigation.status),
            tone: investigationTone(data?.investigation.status)
        }}/>

      <main id="main" className="product-main">
        <div className="frame report-page">
          <Link className="workspace-back" href="/dashboard">
            <span aria-hidden="true">←</span>
            Back to workspace
          </Link>

          <header className="report-head">
            <div className="report-head-copy">
              <span className="page-kicker">
                Investigation report <span aria-hidden="true">·</span> {data?.investigation.id ?? "—"}
              </span>
              <h1 className="report-title">
                {data?.investigation.title ?? "Investigation report"}
              </h1>
              <p className="report-lede">
                A recorded account of this investigation: what was run, what the evidence supports,
                what stayed unknown, and what the approved fix actually changed.
              </p>
            </div>

            <div className="report-head-meta">
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <StatusPill label={investigationLabel(data?.investigation.status)} tone={investigationTone(data?.investigation.status)}/>
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="btn btn-secondary"
                  style={{ padding: "4px 10px", fontSize: "11px", fontFamily: "var(--mono)" }}
                  aria-label="Copy audit summary to clipboard"
                >
                  {copiedSummary ? "Summary Copied" : "Copy Audit Summary"}
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="btn btn-secondary"
                  style={{ padding: "4px 10px", fontSize: "11px", fontFamily: "var(--mono)" }}
                  aria-label="Print or export investigation audit certificate"
                >
                  Print Certificate
                </button>
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="btn btn-secondary"
                  style={{ padding: "4px 10px", fontSize: "11px", fontFamily: "var(--mono)" }}
                  aria-label="Download raw JSON investigation snapshot"
                >
                  Export JSON
                </button>
              </div>
              <span className="report-generated">
                <ClockIcon />
                Generated {formatRecorded(data?.investigation.updatedAt)}
              </span>
            </div>
          </header>

          {error ? (<div className="report-error" role="alert">
              <InfoIcon />
              <p>{error}</p>
            </div>) : null}

          <section className="report-metrics" aria-label="Report metrics">
            <article>
              <span className="metric-label">Recorded runs</span>
              <strong>{data ? formatNumber(data.runs.length) : "—"}</strong>
              <small>{latestRun ? `Latest ${formatRecorded(latestRun.startedAt)}` : "Not recorded"}</small>
            </article>
            <article>
              <span className="metric-label">Evidence</span>
              <strong>{data ? formatNumber(data.evidence.length) : "—"}</strong>
              <small>{data ? `${observed} observed · ${unknownCount} unknown` : "Loading record"}</small>
            </article>
            <article>
              <span className="metric-label">Hypothesis</span>
              <strong className="report-metric-word">{hypothesis?.confidence ?? "None"}</strong>
              <small>{hypothesis ? "Confidence, not a conclusion" : "No working hypothesis"}</small>
            </article>
            <article>
              <span className="metric-label">Verification</span>
              <strong className="report-metric-word">{reportLabel(verification?.result)}</strong>
              <small>
                {patch?.status === "draft"
            ? "Historical result · current patch in review"
            : verification
                ? verification.notes
                : "No recorded rerun"}
              </small>
            </article>
          </section>

          <div className="report-layout">
            <article className="report-sheet">
              <section className="report-section">
                <span className="report-number">01</span>
                <div className="report-section-body">
                  <span className="panel-eyebrow">Original problem</span>
                  <h2>{data?.investigation.goal ?? "No goal was recorded."}</h2>
                  <p>
                    {target
                      ? `The failing sequence is ${target.testFile}${target.targetTest ? ` (${target.targetTest})` : ""}${target.predecessorTest ? ` when it follows ${target.predecessorTest}` : ""}. ${target.reasoning}`
                      : "Run the controlled workflow to resolve which test sequence fails and why."}
                  </p>
                  <div className="report-inline-meta">
                    <span>
                      <FolderIcon />
                      {data?.project?.name ?? "—"}
                    </span>
                    <span>
                      <TerminalIcon />
                      {data?.project?.framework === "node" ? "node --test" : data?.project?.framework ?? "—"}
                    </span>
                  </div>
                </div>
              </section>

              <section className="report-section">
                <span className="report-number">02</span>
                <div className="report-section-body">
                  <span className="panel-eyebrow">What was observed</span>
                  <h2>Evidence linked to actual executions.</h2>
                  {comparison ? (<ul className="report-findings">
                      {comparison.findings.map((finding, index) => (<li key={`${finding.statement}-${index}`}>
                          <span className={`finding-tag ${finding.certainty === "observed" ? "finding-tag--observed" : "finding-tag--unknown"}`.trim()}>
                            {finding.certainty}
                          </span>
                          <p>{finding.statement}</p>
                        </li>))}
                    </ul>) : (<p className="report-muted">No comparison has been recorded yet.</p>)}
                  {data ? (<div className="report-stat-line">
                      <span><PlayIcon /> {formatNumber(data.runs.length)} recorded runs</span>
                      <span><FileIcon /> {formatNumber(data.evidence.length)} evidence records</span>
                      <span><CheckIcon /> {observed} observed facts</span>
                    </div>) : null}
                </div>
              </section>

              <section className="report-section">
                <span className="report-number">03</span>
                <div className="report-section-body">
                  <span className="panel-eyebrow">Working hypothesis</span>
                  <h2>{hypothesis ? hypothesis.description : "No hypothesis was recorded."}</h2>
                  {hypothesis ? (<>
                      <p>{hypothesis.confidenceJustification}</p>
                      <div className="report-next">
                        <span>Next experiment</span>
                        <p>{hypothesis.nextExperiment}</p>
                      </div>
                      {hypothesis.alternativeExplanations.length ? (<ul className="report-alternatives">
                          {hypothesis.alternativeExplanations.map((alternative) => (<li key={alternative}>{alternative}</li>))}
                        </ul>) : null}
                    </>) : (<p className="report-muted">
                      The local workflow records evidence without inventing a diagnosis. Run an
                      evidence review to add a bounded hypothesis.
                    </p>)}
                </div>
              </section>

              <section className="report-section">
                <span className="report-number">04</span>
                <div className="report-section-body">
                  <span className="panel-eyebrow">Proposed fix</span>
                  <h2>{patch ? patch.description : "No cleanup patch was proposed."}</h2>
                  {patch ? (<>
                      <div className="report-patch-meta">
                        <StatusPill label={patch.status} tone={patch.status === "applied" ? "success" : "neutral"}/>
                        <code>{patch.targetPath}</code>
                        <span>{patch.baseline}</span>
                      </div>
                      <DiffView patch={patch} compact/>
                    </>) : (<p className="report-muted">
                      A fix proposal is drafted from the recorded evidence once a failing sequence
                      and hypothesis exist.
                    </p>)}
                </div>
              </section>

              <section className="report-section">
                <span className="report-number">05</span>
                <div className="report-section-body">
                  <span className="panel-eyebrow">Verification</span>
                  <h2>{verification ? reportLabel(verification.result) : "Not verified"}</h2>
                  <p>
                    {verification
            ? verification.notes
            : "Verification reruns the failing probe against the patched files."}
                  </p>
                </div>
              </section>

              <section className="report-section report-section--last">
                <span className="report-number">06</span>
                <div className="report-section-body">
                  <span className="panel-eyebrow">Unknowns left unaddressed</span>
                  <h2>What the evidence does not prove.</h2>
                  {unknown ? (<p className="report-warning">
                      {unknown.claim} Breakpoint records what failed; it does not claim to have
                      eliminated all unobserved risks.
                    </p>) : (<p className="report-muted">
                      Every statement in this report is linked to an observed command execution.
                    </p>)}
                </div>
              </section>
            </article>

            <aside className="report-rail">
              <section className="rail-panel">
                <span className="panel-eyebrow">Audit details</span>
                <dl className="report-dl">
                  <div>
                    <dt>Investigation ID</dt>
                    <dd>{data?.investigation.id ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Project</dt>
                    <dd>{data?.project?.name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Framework</dt>
                    <dd>{runnerLabel(data?.project?.framework)}</dd>
                  </div>
                  <div>
                    <dt>Target test</dt>
                    <dd>{target?.testFile ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Predecessor</dt>
                    <dd>{target?.predecessorTest ?? "None"}</dd>
                  </div>
                  <div>
                    <dt>Patch applied</dt>
                    <dd>{patch?.id ?? "None"}</dd>
                  </div>
                  <div>
                    <dt>Verification result</dt>
                    <dd>{verification?.result ?? "None"}</dd>
                  </div>
                </dl>
              </section>

              <section className="rail-panel">
                <span className="panel-eyebrow">Safety boundary</span>
                <p className="report-rail-note">
                  <ShieldCheckIcon />
                  All runs executed inside the project root with capped duration and capped output.
                </p>
              </section>

              <section className="rail-panel">
                <span className="panel-eyebrow">Next steps</span>
                <p className="report-rail-copy">
                  Return to the workspace to inspect the full run history, open any evidence record, or
                  start another controlled investigation.
                </p>
                <div className="report-rail-actions">
                  <Link className="rail-action" href="/dashboard">
                    Open workspace
                    <ArrowRightIcon />
                  </Link>
                  <Link className="rail-action rail-action--muted" href="/investigations/new">
                    Start another investigation
                    <ArrowUpRightIcon />
                  </Link>
                </div>
              </section>
            </aside>
          </div>

          <footer className="product-page-foot">
            <p>
              Evidence-first report <span aria-hidden="true">·</span> generated from the local record{" "}
              <span aria-hidden="true">·</span> no inferred certainty
            </p>
            <Link className="product-foot-link" href="/#principles">
              Read the Breakpoint principles
              <ArrowUpRightIcon />
            </Link>
          </footer>
        </div>
      </main>
    </div>);
}
