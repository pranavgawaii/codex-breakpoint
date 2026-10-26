import { Mark } from "./brand-mark";
function SearchIcon() {
    return (<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7.1" cy="7.1" r="4.3" stroke="currentColor" strokeWidth="1.4"/>
      <path d="m10.4 10.4 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>);
}
function GridIcon() {
    return (<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.2" y="2.2" width="4.6" height="4.6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="9.2" y="2.2" width="4.6" height="4.6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="2.2" y="9.2" width="4.6" height="4.6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="9.2" y="9.2" width="4.6" height="4.6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    </svg>);
}
function LayersIcon() {
    return (<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="m8 2.4 5.4 2.7L8 7.8 2.6 5.1 8 2.4Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="m3.2 8 4.8 2.4L12.8 8M3.2 10.9 8 13.3l4.8-2.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>);
}
function AlertIcon() {
    return (<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.5 14 13H2L8 2.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M8 6.2v3.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="8" cy="11.2" r="0.8" fill="currentColor"/>
    </svg>);
}
export function EvidencePanel({ snapshot, error, running, onPatchAction }) {
    const hypothesis = snapshot?.hypotheses.at(-1);
    const evidence = snapshot?.evidence.slice(-3).reverse() ?? [];
    const latestRun = snapshot?.runs.at(-1);
    const patch = snapshot?.patches.at(-1);
    const verification = snapshot?.verifications.at(-1);
    if (!snapshot && !error) {
        return (<div className="result-card">
        <div className="panel-heading">
          <div>
            <p className="panel-label">Run evidence</p>
            <h3>Loading the investigation record…</h3>
          </div>
        </div>
        <p className="empty-panel">Waiting for the local investigation store.</p>
      </div>);
    }
    return (<div className="result-card">
      <div className="panel-heading">
        <div>
          <p className="panel-label">Run evidence</p>
          <h3>{hypothesis?.description ?? "Run the controlled comparison to collect evidence"}</h3>
        </div>
        <span className="confidence">{hypothesis ? `${hypothesis.confidence} confidence` : "No claim yet"}</span>
      </div>

      <div className="findings">
        {error ? (<div>
            <span className="claim unknown">Runner error</span>
            <p>{error}</p>
          </div>) : evidence.length ? (evidence.map((item) => (<div key={item.id}>
              <span className={`claim ${item.observed ? "observed" : "unknown"}`}>
                {item.observed ? "Observed" : "Unknown"}
              </span>
              <p>
                {item.statement}
                <code>{item.id}</code>
              </p>
            </div>))) : (<div>
            <span className="claim unknown">Unknown</span>
            <p>No execution evidence yet. The UI does not infer a cause before a run.</p>
          </div>)}
      </div>

      {latestRun && (<div className="command-line">
          <span aria-hidden="true">›</span>
          <code>{latestRun.command.slice(1).join(" ")}</code>
          <b>exit {latestRun.exitCode ?? "—"}</b>
        </div>)}
      {patch && (<div className="command-line">
          <span aria-hidden="true">✓</span>
          <code>
            Patch: {patch.description} · {patch.status}
          </code>
          <b>{verification ? `verification ${verification.result}` : "awaiting approval"}</b>
        </div>)}

      {snapshot && (<div className="panel-actions">
          {patch?.status === "draft" ? (<button type="button" className="btn btn-primary panel-action" onClick={() => onPatchAction("approve-patch")} disabled={running}>
              {running ? "Verifying…" : "Approve & verify fix"}
            </button>) : patch?.status === "applied" ? (<button type="button" className="btn btn-secondary panel-action" onClick={() => onPatchAction("revert-patch")} disabled={running}>
              {running ? "Reverting…" : "Revert patch"}
            </button>) : (<button type="button" className="btn btn-secondary panel-action" onClick={() => onPatchAction("propose-patch")} disabled={running}>
              {running ? "Working…" : "Propose cleanup fix"}
            </button>)}
        </div>)}
    </div>);
}
export function ComparisonPanel({ snapshot }) {
    const comparison = snapshot?.comparisons.at(-1);
    const runs = snapshot?.runs ?? [];
    const failing = runs.slice().reverse().find((run) => run.status === "failed");
    const passing = runs.slice().reverse().find((run) => run.status === "passed");
    if (!comparison || !failing || !passing) {
        return (<div className="result-card">
        <div className="panel-heading">
          <div>
            <p className="panel-label">Run comparison</p>
            <h3>Two runs, side by side</h3>
          </div>
          <span className="confidence">No comparison yet</span>
        </div>
        <p className="empty-panel">Run the investigation to compare two actual executions.</p>
      </div>);
    }
    return (<div className="result-card">
      <div className="panel-heading">
        <div>
          <p className="panel-label">Run comparison</p>
          <h3>What changed between the recorded runs</h3>
        </div>
        <span className="confidence">{comparison.findings.length} findings</span>
      </div>

      <div className="run-columns">
        <article>
          <div>
            <span className="red-dot" aria-hidden="true"/> Failing run
          </div>
          <h3>{failing.id}</h3>
          <p>{failing.tests.map((test) => test.name).join(" → ") || "test results unavailable"}</p>
          <code>
            exit {failing.exitCode} · {failing.durationMs} ms
          </code>
        </article>
        <article>
          <div>
            <span className="green-dot" aria-hidden="true"/> Passing run
          </div>
          <h3>{passing.id}</h3>
          <p>{passing.tests.map((test) => test.name).join(" → ") || "test results unavailable"}</p>
          <code>
            exit {passing.exitCode} · {passing.durationMs} ms
          </code>
        </article>
      </div>

      <div className="diff">
        <span>Recorded findings</span>
        {comparison.findings.slice(0, 3).map((finding, index) => (<b key={`${finding.statement}-${index}`}>{finding.statement}</b>))}
      </div>
    </div>);
}
export function InvestigationWindow({ snapshot, error, running, tab, onTabChange, onRun, onPatchAction }) {
    const status = snapshot?.investigation.status;
    const statusLabel = status === "needs_review" ? "Needs review" : status === "verified" ? "Verified" : "Ready to run";
    const statusTone = status === "needs_review" ? "warning" : status === "verified" ? "success" : "neutral";
    const hypothesis = snapshot?.hypotheses.at(-1);
    const title = snapshot?.investigation.title ?? "Session state persists between tests";
    return (<>
      <div className="window-wrap">
        <div className="glow" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="window">
          <div className="rail" aria-hidden="true">
            <span className="rail-logo">
              <Mark />
            </span>
            <span className="rail-icon active">
              <GridIcon />
            </span>
            <span className="rail-icon">
              <SearchIcon />
            </span>
            <span className="rail-icon">
              <LayersIcon />
            </span>
            <span className="rail-icon">
              <AlertIcon />
            </span>
          </div>

          <div className="window-inner">
            <div className="window-head">
              <span className="head-icon">
                <SearchIcon />
              </span>
              <span className="crumb">Investigation</span>
              <span className="sep">/</span>
              <strong>{title}</strong>
              <div className="window-head-actions">
                <span className="live">
                  <i aria-hidden="true"/>
                  {running ? "Running" : "Local demo"}
                </span>
                <button type="button" className="btn btn-primary head-run" onClick={onRun} disabled={running} aria-busy={running}>
                  {running ? "Running…" : "Run investigation"}
                  {!running && <span aria-hidden="true">→</span>}
                </button>
              </div>
            </div>

            <div className="window-body">
              <aside className="window-meta">
                <div>
                  <div className="label">Workspace</div>
                  <h3>{title}</h3>
                  <p className="meta-copy">Recorded runs, linked evidence and a bounded hypothesis.</p>
                </div>

                <div className="meta-status">
                  <span className={`status-dot ${statusTone}`} aria-hidden="true"/>
                  {statusLabel}
                </div>

                <div className="meta-rule"/>

                <div className="meta-row">
                  <span>Runs</span>
                  <span>{snapshot ? `${snapshot.runs.length} recorded` : "Loading…"}</span>
                </div>
                <div className="meta-row">
                  <span>Evidence</span>
                  <span>{snapshot ? `${snapshot.evidence.length} linked` : "—"}</span>
                </div>
                <div className="meta-row">
                  <span>Hypothesis</span>
                  <span>{hypothesis ? hypothesis.confidence : "None yet"}</span>
                </div>
                <div className="meta-row">
                  <span>Mode</span>
                  <span>Local only</span>
                </div>
              </aside>

              <section className="window-results">
                <div className="console-tabs" role="tablist" aria-label="Investigation views">
                  <button type="button" id="evidence-tab" role="tab" aria-selected={tab === "evidence"} aria-controls="evidence-panel" className={`console-tab ${tab === "evidence" ? "active" : ""}`} onClick={() => onTabChange("evidence")}>
                    Evidence
                  </button>
                  <button type="button" id="comparison-tab" role="tab" aria-selected={tab === "comparison"} aria-controls="comparison-panel" className={`console-tab ${tab === "comparison" ? "active" : ""}`} onClick={() => onTabChange("comparison")}>
                    Run comparison
                  </button>
                  <span className="window-file">test/session-flow.test.js</span>
                </div>

                <div role="tabpanel" id={tab === "evidence" ? "evidence-panel" : "comparison-panel"} aria-labelledby={tab === "evidence" ? "evidence-tab" : "comparison-tab"}>
                  {tab === "evidence" ? (<EvidencePanel snapshot={snapshot} error={error} running={running} onPatchAction={onPatchAction}/>) : (<ComparisonPanel snapshot={snapshot}/>)}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>);
}
