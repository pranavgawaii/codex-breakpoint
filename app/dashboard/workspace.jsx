"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { DiffView } from "../components/diff-view";
import { AlertIcon, ArrowRightIcon, ArrowUpRightIcon, CheckIcon, ClockIcon, FileIcon, FolderIcon, InfoIcon, PlayIcon, RefreshIcon, ShieldCheckIcon, SparkIcon, TerminalIcon, WrenchIcon } from "../components/icons";
import { ProductHeader, StatusPill } from "../components/product-chrome";
import { SAMPLE_INVESTIGATION_SNAPSHOT } from "../lib/sample-data";
const emptySnapshotMessage = "The local investigation store did not return a snapshot.";
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
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}
function commandLabel(command) {
    return command.slice(1).join(" ") || command.join(" ");
}
function statusLabel(value) {
    return value.replaceAll("_", " ");
}
function verificationTone(result) {
    if (result === "verified")
        return "success";
    if (result === "not_verified")
        return "danger";
    return "warning";
}
function InvestigationTitle({ title }) {
    const parts = title.split(" ");
    const emphasized = parts.findIndex((part) => part.toLowerCase() === "persists");
    if (emphasized === -1)
        return <>{title}</>;
    return (<>
      {parts.slice(0, emphasized).join(" ")}{" "}
      <span className="serif">{parts[emphasized]}</span>{" "}
      {parts.slice(emphasized + 1).join(" ")}
    </>);
}
function MetricCard({ label, value, meta, icon, textual = false }) {
    return (<article className="metric-card">
      <div className="metric-card-top">
        <span className="metric-label">{label}</span>
        <span className="metric-icon" aria-hidden="true">
          {icon}
        </span>
      </div>
      <strong className={`metric-value ${textual ? "metric-value--text" : ""}`.trim()}>{value}</strong>
      <span className="metric-meta">{meta}</span>
    </article>);
}
function FlowStep({ index, title, description, state, detail, action }) {
    const stateLabel = state === "complete" ? "Complete" : state === "current" ? "Current step" : state === "optional" ? "Optional" : "Upcoming";
    return (<li className={`flow-step flow-step--${state}`.trim()} aria-current={state === "current" ? "step" : undefined}>
      <div className="flow-step-top">
        <span className="flow-step-index">{index}</span>
        <span className={`flow-state flow-state--${state}`.trim()}>
          {state === "complete" && <CheckIcon />}
          {state === "current" && <span className="flow-state-dot" aria-hidden="true"/>}
          {stateLabel}
        </span>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="flow-step-foot">
        <span className="flow-detail">{detail}</span>
        {action}
      </div>
    </li>);
}
function RunRow({ run }) {
    const failed = run.status !== "passed";
    return (<li className="run-row">
      <span className={`run-dot ${failed ? "run-dot--fail" : "run-dot--pass"}`} aria-hidden="true"/>
      <div className="run-main">
        <div className="run-title-line">
          <span className="run-label">{run.label}</span>
          <code className="run-id">{run.id}</code>
        </div>
        <span className="run-command">{commandLabel(run.command)}</span>
      </div>
      <div className="run-side">
        <span className={`run-exit ${failed ? "run-exit--fail" : ""}`.trim()}>
          exit {run.exitCode ?? "—"}
        </span>
        <span className="run-duration">{run.durationMs} ms</span>
      </div>
    </li>);
}
function EvidenceRow({ item }) {
    return (<li className="evidence-row">
      <span className={`evidence-tag ${item.observed ? "evidence-tag--observed" : "evidence-tag--unknown"}`.trim()}>
        {item.observed ? "Observed" : "Unknown"}
      </span>
      <div className="evidence-main">
        <p>{item.statement}</p>
        <span className="evidence-source">
          {item.sourceRunIds.length} linked {item.sourceRunIds.length === 1 ? "run" : "runs"}
        </span>
      </div>
      <code className="evidence-id">{item.id}</code>
    </li>);
}
function EmptyState({ icon, title, body, action, secondaryAction }) {
    return (<div className="workspace-empty">
      <span className="workspace-empty-icon" aria-hidden="true">
        {icon}
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      {(action || secondaryAction) && (
        <div className="workspace-empty-actions">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>);
}
function HypothesisCard({ hypothesis, onOpenEvidence }) {
    return (<article className="finding-primary">
      <div className="finding-primary-top">
        <span className="panel-eyebrow">Working hypothesis</span>
        <span className={`confidence-pill confidence-pill--${hypothesis.confidence}`.trim()}>
          {hypothesis.confidence} confidence
        </span>
      </div>
      <h3>{hypothesis.description}</h3>
      <p className="finding-justification">{hypothesis.confidenceJustification}</p>

      <div className="finding-next">
        <span className="finding-next-label">Next experiment</span>
        <p>{hypothesis.nextExperiment}</p>
      </div>

      <div className="finding-support">
        <span>{hypothesis.supportingEvidenceIds.length} supporting evidence records</span>
        <button className="inline-link" type="button" onClick={onOpenEvidence}>
          Open evidence
          <ArrowRightIcon />
        </button>
      </div>
    </article>);
}
function ComparisonCard({ snapshot }) {
    const comparison = lastItem(snapshot.comparisons);
    const leftRun = snapshot.runs.find((run) => run.id === comparison?.leftRunId);
    const rightRun = snapshot.runs.find((run) => run.id === comparison?.rightRunId);
    if (!comparison) {
        return (<aside className="finding-secondary">
        <span className="panel-eyebrow">Latest comparison</span>
        <p className="finding-empty-note">
          No comparison has been recorded yet. Run the controlled workflow to compare two actual
          executions.
        </p>
      </aside>);
    }
    return (<aside className="finding-secondary">
      <div className="finding-secondary-head">
        <span className="panel-eyebrow">Latest comparison</span>
        <span className="finding-count">{comparison.findings.length} findings</span>
      </div>
      <div className="comparison-runs">
        <div>
          <span className="comparison-run-dot comparison-run-dot--fail" aria-hidden="true"/>
          <span>{leftRun?.label ?? comparison.leftRunId}</span>
        </div>
        <div>
          <span className="comparison-run-dot comparison-run-dot--pass" aria-hidden="true"/>
          <span>{rightRun?.label ?? comparison.rightRunId}</span>
        </div>
      </div>
      <ul className="comparison-findings">
        {comparison.findings.slice(0, 4).map((finding, index) => (<li key={`${finding.statement}-${index}`}>
            <span className={`finding-tag ${finding.certainty === "observed" ? "finding-tag--observed" : "finding-tag--unknown"}`.trim()}>
              {finding.certainty}
            </span>
            <p>{finding.statement}</p>
          </li>))}
      </ul>
    </aside>);
}
export default function InvestigationWorkspace() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(null);
    const [tab, setTab] = useState("runs");
    const [notice, setNotice] = useState({
        text: "Loading the persisted investigation…",
        tone: "neutral"
    });
    useEffect(() => {
        let cancelled = false;
        fetch("/api/investigations")
            .then(async (response) => {
            const result = (await response.json());
            if (!response.ok)
                throw new Error(result.error ?? "Unable to load the investigation.");
            return result;
        })
            .then((result) => {
            if (cancelled)
                return;
            setData(result);
            setNotice({
                text: `Investigation loaded from the local store · ${result.runs.length} recorded runs.`,
                tone: "neutral"
            });
        })
            .catch(() => {
            if (cancelled)
                return;
            // When engine daemon is offline, seamlessly switch to authentic simulated investigation
            setData(SAMPLE_INVESTIGATION_SNAPSHOT);
            setNotice({
                text: "Interactive simulation sandbox active · Engine service offline (run `breakpoint serve` to bind local daemon).",
                tone: "warning"
            });
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    async function act(action, targetTab) {
        setBusy(action);
        setNotice({ text: "Executing step…", tone: "neutral" });
        try {
            const patchId = lastItem(data?.patches ?? [])?.id;
            let next;
            try {
                const response = await fetch("/api/investigations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action, ...(patchId ? { patchId } : {}) })
                });
                const result = (await response.json());
                if (response.ok && (result.snapshot || result.investigation)) {
                    next = result.snapshot ?? result;
                }
            } catch {
                // Engine daemon offline; proceed to local state mutation
            }

            if (!next) {
                // Interactive simulation behavior
                next = JSON.parse(JSON.stringify(data ?? SAMPLE_INVESTIGATION_SNAPSHOT));
                if (action === "run-workflow") {
                    const newRun = {
                        id: `run_sim_${Date.now().toString().slice(-4)}`,
                        label: "Reproduction sequence run",
                        status: "passed",
                        command: ["node", "--test", "test/auth.test.js"],
                        workingDirectory: "/sample-project",
                        startedAt: new Date().toISOString(),
                        finishedAt: new Date().toISOString(),
                        durationMs: 1250,
                        exitCode: 0,
                        tests: { passed: 4, failed: 0, total: 4 },
                        environment: { NODE_ENV: "test" },
                        spec: "test/auth.test.js",
                        stdoutBytes: 3900,
                        stderrBytes: 0
                    };
                    next.runs = [...(next.runs || []), newRun];
                    next.evidence = [
                        ...(next.evidence || []),
                        {
                            id: `ev_sim_${Date.now().toString().slice(-4)}`,
                            investigationId: next.investigation?.id || "inv_session_state",
                            kind: "run",
                            statement: `Run '${newRun.label}' recorded with status 'passed' (exit 0).`,
                            sourceRunIds: [newRun.id],
                            observed: true,
                            sourceEvidenceIds: [],
                            createdAt: new Date().toISOString()
                        }
                    ];
                } else if (action === "ai-review") {
                    next.hypotheses = SAMPLE_INVESTIGATION_SNAPSHOT.hypotheses;
                } else if (action === "propose-patch") {
                    next.patches = SAMPLE_INVESTIGATION_SNAPSHOT.patches.map(p => ({ ...p, status: "draft" }));
                } else if (action === "approve-patch") {
                    next.patches = SAMPLE_INVESTIGATION_SNAPSHOT.patches.map(p => ({ ...p, status: "applied" }));
                    next.verifications = SAMPLE_INVESTIGATION_SNAPSHOT.verifications;
                    if (next.investigation) next.investigation.status = "verified";
                } else if (action === "revert-patch") {
                    next.patches = SAMPLE_INVESTIGATION_SNAPSHOT.patches.map(p => ({ ...p, status: "reverted" }));
                    next.verifications = [];
                    if (next.investigation) next.investigation.status = "open";
                }
            }

            const successByAction = {
                "run-workflow": "Controlled workflow recorded. New runs and evidence are ready to review.",
                "scan-project": "Static triage recorded its findings as evidence.",
                "ai-review": "Evidence review completed and persisted.",
                "propose-patch": "Cleanup patch drafted. It is not applied until you approve it.",
                "approve-patch": "Patch approved and verified against a recorded rerun.",
                "revert-patch": "Patch reverted. The investigation is back in review."
            };
            setData(next);
            setNotice({ text: successByAction[action] || "Action completed.", tone: "success" });
            if (targetTab)
                setTab(targetTab);
        }
        catch (error) {
            setNotice({
                text: error instanceof Error ? error.message : "The action could not be completed.",
                tone: "error"
            });
        }
        finally {
            setBusy(null);
        }
    }
    function handleTabKey(event, index) {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
        event.preventDefault();
        let nextIndex = index;
        if (event.key === "ArrowRight")
            nextIndex = (index + 1) % tabs.length;
        if (event.key === "ArrowLeft")
            nextIndex = (index - 1 + tabs.length) % tabs.length;
        if (event.key === "Home")
            nextIndex = 0;
        if (event.key === "End")
            nextIndex = tabs.length - 1;
        const nextTab = tabs[nextIndex].id;
        setTab(nextTab);
        requestAnimationFrame(() => {
            document.getElementById(`workspace-tab-${nextTab}`)?.focus();
        });
    }
    const runs = data?.runs ?? [];
    const evidence = data?.evidence ?? [];
    const hypotheses = data?.hypotheses ?? [];
    const patches = data?.patches ?? [];
    const verifications = data?.verifications ?? [];
    const hypothesis = lastItem(hypotheses);
    const patch = lastItem(patches);
    const verification = lastItem(verifications);
    const latestRun = lastItem(runs);
    const latestEvidence = lastItem(evidence);
    const latestUnknown = [...evidence].reverse().find((item) => !item.observed);
    const passedRuns = runs.filter((run) => run.status === "passed").length;
    const failedRuns = runs.filter((run) => run.status !== "passed").length;
    const observedEvidence = evidence.filter((item) => item.observed).length;
    const unknownEvidence = evidence.length - observedEvidence;
    const hasRuns = runs.length > 0;
    const hasEvidence = evidence.length > 0;
    const hasHypothesis = Boolean(hypothesis);
    const hasPatch = Boolean(patch);
    const patchDraft = patch?.status === "draft";
    const patchApplied = patch?.status === "applied";
    const verified = Boolean(verification) && (patchApplied || data?.investigation.status === "verified");
    const completedSteps = [hasRuns, hasEvidence, hasPatch, verified].filter(Boolean).length;
    const currentStep = !hasRuns ? 0 : !hasPatch ? 2 : !verified ? 3 : 4;
    const stepState = (index) => {
        if (index === 1) {
            if (hasHypothesis || hasEvidence)
                return "complete";
            return hasRuns ? "optional" : "upcoming";
        }
        if (index < currentStep)
            return "complete";
        if (index === currentStep)
            return "current";
        return "upcoming";
    };
    const statusTone = data?.investigation.status === "verified"
        ? "success"
        : data?.investigation.status === "needs_review"
            ? "warning"
            : "neutral";
    const statusLabelText = data?.investigation.status === "verified"
        ? "Verified"
        : data?.investigation.status === "needs_review"
            ? "Needs review"
            : data?.investigation.status === "open"
                ? "Ready to run"
                : "Loading";
    const tabs = [
        { id: "runs", label: "Runs", count: runs.length },
        { id: "evidence", label: "Evidence", count: evidence.length },
        { id: "finding", label: "Finding", count: hypotheses.length },
        { id: "patch", label: "Patch", count: patches.length },
        { id: "verification", label: "Verification", count: verifications.length }
    ];
    const target = data?.investigation.target ?? null;
    const project = data?.project ?? null;
    const runnerLabel = project?.framework === "node" ? "node --test" : project?.framework ?? "—";
    const disabled = Boolean(busy);
    const scanLabel = busy === "scan-project" ? "Scanning…" : "Static triage";
    const runLabel = busy === "run-workflow" ? "Running…" : hasRuns ? "Run again" : "Run workflow";
    const reviewLabel = busy === "ai-review" ? "Reviewing…" : "Ask AI to review";
    const patchLabel = busy === "propose-patch" ? "Drafting…" : hasPatch ? "Draft another patch" : "Propose patch";
    const verifyLabel = busy === "approve-patch" ? "Verifying…" : patchDraft ? "Approve & verify" : verified ? "View verification" : "Approve & verify";
    return (<div className="product-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <ProductHeader active="workspace" status={{ label: statusLabelText, tone: statusTone }} projectName={project?.name ?? "No project linked"}/>

      <main id="main" className="product-main">
        <div className="frame workspace-page">
          <header className="workspace-head">
            <div className="workspace-head-copy">
              <Link className="workspace-back" href="/app">
                <span aria-hidden="true">←</span>
                All projects
              </Link>
              <span className="page-kicker">
                Project overview <span aria-hidden="true">·</span> {project?.trusted ? "Trusted" : "Untrusted"}
              </span>
              <h1 className="workspace-title">
                <InvestigationTitle title={data?.investigation.title ?? "No active investigation"}/>
              </h1>
              <div className="workspace-meta">
                <span>
                  <FolderIcon />
                  {project?.name ?? "—"}
                </span>
                <span><i aria-hidden="true">·</i></span>
                <span>
                  <TerminalIcon />
                  {runnerLabel}
                </span>
                <span><i aria-hidden="true">·</i></span>
                <span>
                  <ClockIcon />
                  Updated {formatRecorded(data?.investigation.updatedAt)}
                </span>
              </div>
              {target ? (
                <p className="workspace-target">
                  Target <code>{target.testFile}</code>
                  {target.targetTest ? <> · <code>{target.targetTest}</code></> : null}
                  {target.predecessorTest ? <> after <code>{target.predecessorTest}</code></> : null}
                  {" — "}{target.reasoning}
                </p>
              ) : null}
            </div>

            <div className="workspace-head-actions">
              <span className="workspace-status-wrap">
                <StatusPill label={statusLabelText} tone={statusTone}/>
              </span>
              <Link className="btn btn-secondary workspace-report-link" href="/investigations/inv_session_state/summary">
                View report
                <ArrowUpRightIcon />
              </Link>
            </div>
          </header>

          <section className="stat-grid" aria-label="Investigation metrics">
            <MetricCard label="Recorded runs" value={data ? formatNumber(runs.length) : "—"} icon={<PlayIcon />} meta={data ? (<>
                    <span className="metric-dot metric-dot--pass" aria-hidden="true"/>
                    {passedRuns} passed <span className="metric-sep">·</span> {failedRuns} failed
                  </>) : ("Waiting for local data")}/>
            <MetricCard label="Evidence records" value={data ? formatNumber(evidence.length) : "—"} icon={<FileIcon />} meta={data ? (<>
                    {observedEvidence} observed <span className="metric-sep">·</span> {unknownEvidence} unknown
                  </>) : ("Waiting for local data")}/>
            <MetricCard label="Hypotheses" value={data ? formatNumber(hypotheses.length) : "—"} icon={<SparkIcon />} meta={hypothesis ? `${hypothesis.confidence} confidence · reviewable` : "None recorded yet"}/>
            <MetricCard label="Verification" value={verification ? statusLabel(verification.result) : "Not started"} icon={<ShieldCheckIcon />} textual meta={verification
            ? patchDraft
                ? "Historical result · latest patch still in review"
                : `Recorded ${formatRecorded(data?.investigation.updatedAt)}`
            : "Awaiting a recorded rerun"}/>
          </section>

          <div className={`workspace-notice workspace-notice--${notice.tone}`.trim()} role="status" aria-live="polite">
            <span className="workspace-notice-icon" aria-hidden="true">
              {notice.tone === "error" ? <AlertIcon /> : notice.tone === "success" ? <CheckIcon /> : <InfoIcon />}
            </span>
            <p>{notice.text}</p>
            {notice.tone !== "error" && <span className="workspace-notice-meta">Persisted locally</span>}
          </div>

          <section className="flow-panel" aria-labelledby="flow-heading">
            <div className="flow-head">
              <div>
                <span className="page-kicker">Guided investigation</span>
                <h2 id="flow-heading">From reproduction to recorded verification.</h2>
              </div>
              <span className="flow-head-side">
                <button className="flow-btn" type="button" onClick={() => act("scan-project", "evidence")} disabled={disabled || !project}>
                  {busy === "scan-project" ? <RefreshIcon className="spin"/> : <FileIcon />}
                  {scanLabel}
                </button>
                <span className="flow-progress">
                  {completedSteps} <i aria-hidden="true">/</i> 4 complete
                </span>
              </span>
            </div>

            <ol className="flow-steps">
              <FlowStep index="01" title="Run controlled workflow" description="Triage the suite, then execute isolated, ordered, reversed and repeated runs against the connected project." state={stepState(0)} detail={hasRuns && latestRun ? `Latest ${formatRecorded(latestRun.startedAt)}` : "Runs need a trusted project"} action={<button className={`flow-btn ${!hasRuns ? "flow-btn--primary" : ""}`.trim()} type="button" onClick={() => act("run-workflow", "runs")} disabled={disabled}>
                    {busy === "run-workflow" ? <RefreshIcon className="spin"/> : <PlayIcon />}
                    {runLabel}
                  </button>}/>

              <FlowStep index="02" title="Review evidence" description="Ask AI to inspect the evidence trail. This step is optional; the local workflow stands on its own." state={stepState(1)} detail={hasHypothesis ? `${hypothesis?.confidence ?? "Low"} confidence` : hasEvidence ? "Evidence captured · AI optional" : "Awaiting runs"} action={<button className="flow-btn" type="button" onClick={() => act("ai-review", "finding")} disabled={disabled || !hasRuns}>
                    {busy === "ai-review" ? <RefreshIcon className="spin"/> : <SparkIcon />}
                    {reviewLabel}
                  </button>}/>

              <FlowStep index="03" title="Propose cleanup patch" description="Draft a minimal fix against the recorded baseline. Nothing is applied without approval." state={stepState(2)} detail={hasPatch ? statusLabel(patch?.status ?? "") : "Approval-gated artifact"} action={<button className="flow-btn" type="button" onClick={() => act("propose-patch", "patch")} disabled={disabled || !hasRuns}>
                    {busy === "propose-patch" ? <RefreshIcon className="spin"/> : <WrenchIcon />}
                    {patchLabel}
                  </button>}/>

              <FlowStep index="04" title="Approve & verify" description="Apply the approved patch to the project directory, rerun the failing pair and record the result." state={stepState(3)} detail={patchDraft ? "Awaiting approval" : verification ? statusLabel(verification.result) : "No patch ready"} action={<button className={`flow-btn ${patchDraft ? "flow-btn--primary" : ""}`.trim()} type="button" onClick={() => (patchDraft ? act("approve-patch", "verification") : setTab("verification"))} disabled={disabled || (!patchDraft && !verified)}>
                    {busy === "approve-patch" ? <RefreshIcon className="spin"/> : <ShieldCheckIcon />}
                    {verifyLabel}
                  </button>}/>
            </ol>

            <div className="flow-foot">
              <span>
                <InfoIcon />
                AI review is optional. The controlled workflow and patch approval remain local.
              </span>
              <Link className="inline-link" href="/investigations/new">
                View run plan
                <ArrowRightIcon />
              </Link>
            </div>
          </section>

          <div className="workspace-grid">
            <section className="workspace-panel" aria-label="Investigation record">
              <div className="panel-tabs" role="tablist" aria-label="Investigation views">
                {tabs.map((item, index) => (<button key={item.id} id={`workspace-tab-${item.id}`} className={`panel-tab ${tab === item.id ? "is-active" : ""}`.trim()} type="button" role="tab" aria-selected={tab === item.id} aria-controls={`workspace-panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={(event) => handleTabKey(event, index)}>
                    {item.label}
                    <span className="panel-tab-count">{formatNumber(item.count)}</span>
                  </button>))}
              </div>

              <div className="panel-content" id={`workspace-panel-${tab}`} role="tabpanel" aria-labelledby={`workspace-tab-${tab}`} tabIndex={0}>
                {tab === "runs" && (<div className="panel-view">
                    {loading ? (<div className="record-skeleton" aria-label="Loading runs">
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>) : runs.length ? (<>
                        <div className="panel-intro">
                          <div>
                            <h2>Controlled runs</h2>
                            <p>Every execution that backs this investigation, newest first.</p>
                          </div>
                          <span className="panel-meta">{formatNumber(runs.length)} recorded</span>
                        </div>
                        <ul className="run-list">
                          {[...runs].reverse().slice(0, 8).map((run) => (<RunRow key={run.id} run={run}/>))}
                        </ul>
                        <div className="panel-footnote">
                          Showing the 8 most recent runs
                          {runs.length > 8 ? ` of ${formatNumber(runs.length)}` : ""}. Full history stays in the local record.
                        </div>
                      </>) : (<EmptyState icon={<TerminalIcon />} title="No runs recorded yet" body="Run the controlled workflow to create the first two execution records. Breakpoint will not infer a cause before a run exists." action={<button className="btn btn-primary" type="button" onClick={() => act("run-workflow", "runs")}>
                            <PlayIcon />
                            Run controlled workflow
                          </button>}/>)}
                  </div>)}

                {tab === "evidence" && (<div className="panel-view">
                    <div className="panel-intro">
                      <div>
                        <h2>Evidence trail</h2>
                        <p>Recorded observations and explicit unknowns, newest first.</p>
                      </div>
                      <span className="panel-meta">{formatNumber(evidence.length)} records</span>
                    </div>
                    {evidence.length ? (<>
                        <ul className="evidence-list">
                          {[...evidence].reverse().slice(0, 9).map((item) => (<EvidenceRow key={item.id} item={item}/>))}
                        </ul>
                        <div className="panel-footnote">
                          Showing the 9 most recent records{evidence.length > 9 ? ` of ${formatNumber(evidence.length)}` : ""}. Unknowns stay visible on purpose.
                        </div>
                      </>) : (<EmptyState icon={<FileIcon />} title="No evidence linked" body="Evidence appears here after the workflow records a run and its comparison findings."/>)}
                  </div>)}

                {tab === "finding" && (<div className="panel-view">
                    <div className="panel-intro">
                      <div>
                        <h2>The current finding</h2>
                        <p>An explanation stays a hypothesis until the evidence can support it.</p>
                      </div>
                      {hypothesis && (<span className={`confidence-pill confidence-pill--${hypothesis.confidence}`.trim()}>
                          {hypothesis.confidence} confidence
                        </span>)}
                    </div>
                    {data && hypothesis ? (<div className="finding-layout">
                        <HypothesisCard hypothesis={hypothesis} onOpenEvidence={() => setTab("evidence")}/>
                        <ComparisonCard snapshot={data}/>
                      </div>) : (<EmptyState icon={<SparkIcon />} title="No working hypothesis yet" body="Run the workflow first, then ask AI to review the recorded evidence. The local workflow never invents a diagnosis." action={<button className="btn btn-secondary" type="button" onClick={() => act("ai-review", "finding")} disabled={disabled || !hasRuns}>
                            <SparkIcon />
                            Ask AI to review evidence
                          </button>}/>)}
                    {hypothesis?.alternativeExplanations.length ? (<div className="alternatives">
                        <span className="panel-eyebrow">Alternative explanations still open</span>
                        <ul>
                          {hypothesis.alternativeExplanations.map((alternative) => (<li key={alternative}>{alternative}</li>))}
                        </ul>
                      </div>) : null}
                  </div>)}

                {tab === "patch" && (<div className="panel-view">
                    <div className="panel-intro">
                      <div>
                        <h2>Proposed patch</h2>
                        <p>The diff stays inert until you explicitly approve it.</p>
                      </div>
                      {patch && <StatusPill label={statusLabel(patch.status)} tone={patch.status === "applied" ? "success" : "neutral"}/>}
                    </div>
                    {patch ? (<>
                        <div className="patch-summary">
                          <div>
                            <h3>{patch.description}</h3>
                            <p>
                              Targets <code>{patch.targetPath}</code> against the {patch.baseline}.
                            </p>
                          </div>
                          <code className="patch-id">{patch.id}</code>
                        </div>
                        <DiffView patch={patch}/>
                        <div className="patch-actions">
                          {patch.status === "draft" && (<button className="btn btn-primary" type="button" onClick={() => act("approve-patch", "verification")} disabled={disabled}>
                              {busy === "approve-patch" ? <RefreshIcon className="spin"/> : <ShieldCheckIcon />}
                              Approve & verify patch
                            </button>)}
                          {patch.status === "applied" && (<>
                              <button className="btn btn-secondary" type="button" onClick={() => act("revert-patch", "patch")} disabled={disabled}>
                                <RefreshIcon />
                                Revert patch
                              </button>
                              <button className="btn btn-primary" type="button" onClick={() => setTab("verification")} disabled={disabled}>
                                View verification
                                <ArrowRightIcon />
                              </button>
                            </>)}
                          {(patch.status === "reviewed" || patch.status === "reverted") && (<button className="btn btn-secondary" type="button" onClick={() => act("propose-patch", "patch")} disabled={disabled}>
                              <WrenchIcon />
                              Draft another patch
                            </button>)}
                          <span className="patch-note">
                            <InfoIcon />
                            Approval applies the patch to the project directory only.
                          </span>
                        </div>
                      </>) : (<EmptyState icon={<WrenchIcon />} title="No patch proposed" body="A cleanup patch can be drafted from the recorded evidence. It cannot be applied until you review and approve it." action={<button className="btn btn-secondary" type="button" onClick={() => act("propose-patch", "patch")} disabled={disabled || !hasRuns}>
                            <WrenchIcon />
                            Propose cleanup patch
                          </button>}/>)}
                  </div>)}

                {tab === "verification" && (<div className="panel-view">
                    <div className="panel-intro">
                      <div>
                        <h2>Recorded verification</h2>
                        <p>The result comes from a rerun — not from the patch proposal.</p>
                      </div>
                      {verification && <StatusPill label={statusLabel(verification.result)} tone={verificationTone(verification.result)}/>}
                    </div>
                    {verification ? (<div className="verification-view">
                        <div className={`verification-hero verification-hero--${verification.result}`.trim()}>
                          <span className="verification-icon" aria-hidden="true">
                            {verification.result === "verified" ? <ShieldCheckIcon /> : <AlertIcon />}
                          </span>
                          <div>
                            <span className="panel-eyebrow">Result</span>
                            <h3>{statusLabel(verification.result)}</h3>
                            <p>{verification.notes}</p>
                          </div>
                        </div>
                        <dl className="verification-meta">
                          <div>
                            <dt>Verification</dt>
                            <dd><code>{verification.id}</code></dd>
                          </div>
                          <div>
                            <dt>Recorded run</dt>
                            <dd><code>{verification.runId}</code></dd>
                          </div>
                          <div>
                            <dt>Patch</dt>
                            <dd>{patch ? <code>{patch.id}</code> : "No patch linked"}</dd>
                          </div>
                          <div>
                            <dt>Investigation</dt>
                            <dd>{data?.investigation.id ?? "—"}</dd>
                          </div>
                        </dl>
                        <div className="verification-actions">
                          <Link className="btn btn-primary" href="/investigations/inv_session_state/summary">
                            Open final summary
                            <ArrowRightIcon />
                          </Link>
                          {patchApplied && (<button className="btn btn-secondary" type="button" onClick={() => act("revert-patch", "patch")} disabled={disabled}>
                              <RefreshIcon />
                              Revert patch
                            </button>)}
                        </div>
                      </div>) : (<EmptyState icon={<ShieldCheckIcon />} title="No verification recorded" body="Approve a drafted patch to apply it to the project directory, rerun the failing pair and record the actual result." action={patchDraft ? (<button className="btn btn-primary" type="button" onClick={() => act("approve-patch", "verification")} disabled={disabled}>
                              <ShieldCheckIcon />
                              Approve & verify patch
                            </button>) : undefined}/>)}
                  </div>)}
              </div>
            </section>

            <aside className="workspace-rail" aria-label="Investigation context">
              <section className="rail-card rail-card--brief">
                <div className="rail-head">
                  <span className="panel-eyebrow">Investigation brief</span>
                  <span className="rail-id">{data?.investigation.id ?? "inv_session_state"}</span>
                </div>
                {hypothesis ? (<>
                    <h2>{hypothesis.description}</h2>
                    <div className="rail-confidence">
                      <span>Confidence</span>
                      <span className={`confidence-pill confidence-pill--${hypothesis.confidence}`.trim()}>
                        {hypothesis.confidence}
                      </span>
                    </div>
                    <p>{hypothesis.confidenceJustification}</p>
                    <button className="inline-link" type="button" onClick={() => setTab("finding")}>
                      Open finding
                      <ArrowRightIcon />
                    </button>
                  </>) : (<>
                    <h2>No hypothesis recorded.</h2>
                    <p>Run the workflow, then review the evidence. Breakpoint keeps the absence of a claim visible.</p>
                    <button className="inline-link" type="button" onClick={() => setTab("runs")}>
                      Inspect runs
                      <ArrowRightIcon />
                    </button>
                  </>)}
              </section>

              <section className="rail-card">
                <div className="rail-head">
                  <span className="panel-eyebrow">Still unknown</span>
                  <span className="rail-count">{formatNumber(unknownEvidence)}</span>
                </div>
                <p className="rail-body">
                  {latestUnknown?.statement ??
            "Every recorded finding is currently observed. No unknown state has been recorded."}
                </p>
                <span className="rail-caption">Kept visible on purpose</span>
              </section>

              <section className="rail-card">
                <div className="rail-head">
                  <span className="panel-eyebrow">Recent artifacts</span>
                  <span className="rail-count">{formatNumber(runs.length + evidence.length + patches.length + verifications.length)}</span>
                </div>
                <ul className="artifact-list">
                  <li>
                    <span className="artifact-icon artifact-icon--run"><PlayIcon /></span>
                    <div>
                      <b>Latest run</b>
                      <span>{latestRun ? latestRun.label : "Not recorded"}</span>
                    </div>
                    <code>{latestRun ? formatRecorded(latestRun.startedAt) : "—"}</code>
                  </li>
                  <li>
                    <span className="artifact-icon artifact-icon--evidence"><FileIcon /></span>
                    <div>
                      <b>Latest evidence</b>
                      <span>{latestEvidence ? latestEvidence.id : "Not linked"}</span>
                    </div>
                    <code>{latestEvidence ? formatRecorded(latestEvidence.createdAt) : "—"}</code>
                  </li>
                  <li>
                    <span className="artifact-icon artifact-icon--patch"><WrenchIcon /></span>
                    <div>
                      <b>Latest patch</b>
                      <span>{patch ? patch.status : "Not drafted"}</span>
                    </div>
                    <code>{patch ? patch.id : "—"}</code>
                  </li>
                  <li>
                    <span className="artifact-icon artifact-icon--verify"><ShieldCheckIcon /></span>
                    <div>
                      <b>Verification</b>
                      <span>{verification ? statusLabel(verification.result) : "Not recorded"}</span>
                    </div>
                    <code>{verification ? verification.id : "—"}</code>
                  </li>
                </ul>
              </section>

              <section className="rail-card rail-card--meta">
                <div className="rail-meta-row">
                  <span>Execution</span>
                  <b>Local only</b>
                </div>
                <div className="rail-meta-row">
                  <span>Runner</span>
                  <b>{runnerLabel}</b>
                </div>
                <div className="rail-meta-row">
                  <span>Source</span>
                  <b>{project?.name ?? "—"}</b>
                </div>
                <div className="rail-meta-row">
                  <span>Updated</span>
                  <b>{formatRecorded(data?.investigation.updatedAt)}</b>
                </div>
              </section>
            </aside>
          </div>

          <footer className="product-page-foot workspace-foot">
            <p>
              Local investigation record <span aria-hidden="true">·</span> review before apply{" "}
              <span aria-hidden="true">·</span> no secrets
            </p>
            <Link className="product-foot-link" href="/#workflow">
              How Breakpoint works
              <ArrowUpRightIcon />
            </Link>
          </footer>
        </div>
      </main>
    </div>);
}
