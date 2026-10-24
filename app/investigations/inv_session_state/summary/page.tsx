"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { InvestigationSnapshot } from "@/lib/models";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CheckIcon,
  ClockIcon,
  FileIcon,
  FolderIcon,
  InfoIcon,
  PlayIcon,
  ShieldCheckIcon,
  SparkIcon,
  TerminalIcon
} from "../../../components/icons";
import { ProductHeader, StatusPill, type StatusTone } from "../../../components/product-chrome";
import { DiffView } from "../../../components/diff-view";

function lastItem<T>(items: T[]): T | undefined {
  return items.length ? items[items.length - 1] : undefined;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatRecorded(iso?: string) {
  if (!iso) return "Not recorded";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function reportLabel(result?: string) {
  if (!result) return "Not verified";
  const label = result.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function investigationLabel(status?: string) {
  if (status === "verified") return "Verified";
  if (status === "needs_review") return "Needs review";
  if (status === "open") return "Ready to run";
  return "Loading";
}

function investigationTone(status?: string): StatusTone {
  if (status === "verified") return "success";
  if (status === "needs_review") return "warning";
  return "neutral";
}


export default function Summary() {
  const [data, setData] = useState<InvestigationSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/investigations")
      .then(async (response) => {
        const result = (await response.json()) as InvestigationSnapshot & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to load the report.");
        return result;
      })
      .then(setData)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load the report."));
  }, []);

  const hypothesis = lastItem(data?.hypotheses ?? []);
  const comparison = lastItem(data?.comparisons ?? []);
  const patch =
    [...(data?.patches ?? [])].reverse().find((item) => item.status === "applied") ??
    lastItem(data?.patches ?? []);
  const verification = lastItem(data?.verifications ?? []);
  const latestRun = lastItem(data?.runs ?? []);
  const unknown = [...(data?.evidence ?? [])].reverse().find((item) => !item.observed);
  const observed = (data?.evidence ?? []).filter((item) => item.observed).length;
  const unknownCount = (data?.evidence ?? []).length - observed;

  return (
    <div className="product-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <ProductHeader
        active="workspace"
        status={{
          label: investigationLabel(data?.investigation.status),
          tone: investigationTone(data?.investigation.status)
        }}
      />

      <main id="main" className="product-main">
        <div className="frame report-page">
          <Link className="workspace-back" href="/dashboard">
            <span aria-hidden="true">←</span>
            Back to workspace
          </Link>

          <header className="report-head">
            <div className="report-head-copy">
              <span className="page-kicker">
                Investigation report <span aria-hidden="true">·</span> {data?.investigation.id ?? "inv_session_state"}
              </span>
              <h1 className="report-title">
                Session state <span className="serif">persists</span> between tests.
              </h1>
              <p className="report-lede">
                A recorded account of the order-dependent session failure: what was run, what the
                evidence supports, what stayed unknown, and what the approved fix actually changed.
              </p>
            </div>

            <div className="report-head-meta">
              <StatusPill
                label={investigationLabel(data?.investigation.status)}
                tone={investigationTone(data?.investigation.status)}
              />
              <span className="report-generated">
                <ClockIcon />
                Generated {formatRecorded(data?.investigation.updatedAt)}
              </span>
            </div>
          </header>

          {error ? (
            <div className="report-error" role="alert">
              <InfoIcon />
              <p>{error}</p>
            </div>
          ) : null}

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
                  <h2>The session test passed alone and failed after authentication.</h2>
                  <p>
                    The trusted sample establishes a user during the authentication test. When the
                    session test runs immediately after it, module-level state survives into the next
                    test. Run in isolation, the session starts empty and the same test passes.
                  </p>
                  <div className="report-inline-meta">
                    <span>
                      <FolderIcon />
                      breakpoint-session-demo
                    </span>
                    <span>
                      <TerminalIcon />
                      node --test test/session-flow.test.js
                    </span>
                  </div>
                </div>
              </section>

              <section className="report-section">
                <span className="report-number">02</span>
                <div className="report-section-body">
                  <span className="panel-eyebrow">What was observed</span>
                  <h2>Evidence linked to actual executions.</h2>
                  {comparison ? (
                    <ul className="report-findings">
                      {comparison.findings.map((finding, index) => (
                        <li key={`${finding.statement}-${index}`}>
                          <span className={`finding-tag ${finding.certainty === "observed" ? "finding-tag--observed" : "finding-tag--unknown"}`.trim()}>
                            {finding.certainty}
                          </span>
                          <p>{finding.statement}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="report-muted">No comparison has been recorded yet.</p>
                  )}
                  {data ? (
                    <div className="report-stat-line">
                      <span><PlayIcon /> {formatNumber(data.runs.length)} recorded runs</span>
                      <span><FileIcon /> {formatNumber(data.evidence.length)} evidence records</span>
                      <span><CheckIcon /> {observed} observed facts</span>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="report-section">
                <span className="report-number">03</span>
                <div className="report-section-body">
                  <span className="panel-eyebrow">Working hypothesis</span>
                  <h2>{hypothesis ? hypothesis.description : "No hypothesis was recorded."}</h2>
                  {hypothesis ? (
                    <>
                      <p>{hypothesis.confidenceJustification}</p>
                      <div className="report-next">
                        <span>Next experiment</span>
                        <p>{hypothesis.nextExperiment}</p>
                      </div>
                      {hypothesis.alternativeExplanations.length ? (
                        <ul className="report-alternatives">
                          {hypothesis.alternativeExplanations.map((alternative) => (
                            <li key={alternative}>{alternative}</li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  ) : (
                    <p className="report-muted">
                      The local workflow records evidence without inventing a diagnosis. Run an
                      evidence review to add a bounded hypothesis.
                    </p>
                  )}
                </div>
              </section>

              <section className="report-section">
                <span className="report-number">04</span>
                <div className="report-section-body">
                  <span className="panel-eyebrow">Proposed fix</span>
                  <h2>{patch ? patch.description : "No cleanup patch was proposed."}</h2>
                  {patch ? (
                    <>
                      <div className="report-patch-meta">
                        <StatusPill label={patch.status} tone={patch.status === "applied" ? "success" : "neutral"} />
                        <code>{patch.targetPath}</code>
                        <span>{patch.baseline}</span>
                      </div>
                      <DiffView patch={patch} compact />
                    </>
                  ) : (
                    <p className="report-muted">
                      A fix remains review-only until a draft is proposed and explicitly approved.
                    </p>
                  )}
                </div>
              </section>

              <section className="report-section report-section--last">
                <span className="report-number">05</span>
                <div className="report-section-body">
                  <span className="panel-eyebrow">Verification outcome</span>
                  <div className={`report-verification report-verification--${verification?.result ?? "none"}`.trim()}>
                    <span className="report-verification-icon" aria-hidden="true">
                      {verification?.result === "verified" ? <ShieldCheckIcon /> : <InfoIcon />}
                    </span>
                    <div>
                      <h2>{verification ? reportLabel(verification.result) : "No verification recorded."}</h2>
                      <p>
                        {verification
                          ? verification.notes
                          : "Approval and verification are separate steps. This report does not claim a fix works until a rerun records the result."}
                      </p>
                    </div>
                  </div>
                  {verification ? (
                    <>
                      {patch?.status === "draft" ? (
                        <p className="report-muted">
                          This is the latest recorded result. The current draft patch has not been
                          approved or verified yet.
                        </p>
                      ) : null}
                      <dl className="report-verification-meta">
                        <div>
                          <dt>Verification</dt>
                          <dd><code>{verification.id}</code></dd>
                        </div>
                        <div>
                          <dt>Recorded run</dt>
                          <dd><code>{verification.runId}</code></dd>
                        </div>
                      </dl>
                    </>
                  ) : null}
                </div>
              </section>
            </article>

            <aside className="report-rail" aria-label="Report context">
              <section className="rail-card rail-card--brief">
                <div className="rail-head">
                  <span className="panel-eyebrow">Still unknown</span>
                  <span className="rail-count">{formatNumber(unknownCount)}</span>
                </div>
                <p className="rail-body">
                  {unknown?.statement ??
                    "Every recorded finding is currently observed. No unknown state has been recorded."}
                </p>
                <span className="rail-caption">Kept visible on purpose</span>
              </section>

              <section className="rail-card">
                <div className="rail-head">
                  <span className="panel-eyebrow">Report record</span>
                </div>
                <ul className="report-record">
                  <li>
                    <span>Investigation</span>
                    <code>{data?.investigation.id ?? "—"}</code>
                  </li>
                  <li>
                    <span>Project</span>
                    <code>breakpoint-session-demo</code>
                  </li>
                  <li>
                    <span>Runner</span>
                    <code>node --test</code>
                  </li>
                  <li>
                    <span>Mode</span>
                    <code>local only</code>
                  </li>
                  <li>
                    <span>Updated</span>
                    <code>{formatRecorded(data?.investigation.updatedAt)}</code>
                  </li>
                </ul>
              </section>

              <section className="rail-card">
                <div className="rail-head">
                  <span className="panel-eyebrow">Next step</span>
                  <SparkIcon />
                </div>
                <p className="rail-body">
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
    </div>
  );
}
