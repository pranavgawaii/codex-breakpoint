"use client";

import { useState } from "react";

const SCENARIOS = [
  {
    id: "order-dep",
    name: "Order-Dependent Failure",
    kicker: "Global Cache Mutation",
    testFile: "test/session-auth.test.js",
    failTarget: "test/user-profile.test.js",
    isolationPass: true,
    sequenceFail: true,
    latency: "142ms",
    memoryDelta: "+12.4 MB (Dirty State)",
    diff: `// Memory isolation cleanses mutated session cache
- global.__SESSION_STORE = mockSession;
+ const session = isolateContext.createSession(mockSession);
+ afterEach(() => session.teardown());`,
    steps: [
      { step: "01", name: "Static AST Shared-State Scan", status: "pass", time: "18ms", note: "Identified 1 shared singleton ref" },
      { step: "02", name: "Target Test in Isolation", status: "pass", time: "34ms", note: "Exit 0 · 0 assertions failed" },
      { step: "03", name: "Target After Predecessor", status: "fail", time: "65ms", note: "AssertionError: session key stale" },
      { step: "04", name: "Isolated Replay Verification", status: "pass", time: "25ms", note: "Isolated sandbox restores exit 0" }
    ]
  },
  {
    id: "state-bleed",
    name: "Async Handle Leak",
    kicker: "Unclosed Socket Pool",
    testFile: "test/db-pool.test.js",
    failTarget: "test/health-check.test.js",
    isolationPass: true,
    sequenceFail: true,
    latency: "288ms",
    memoryDelta: "+38.1 MB (Handle Leak)",
    diff: `// Ensure connection pool cleanly flushes on exit
  const pool = createPool(config);
+ after(async () => {
+   await pool.drain();
+   await pool.clear();
+ });`,
    steps: [
      { step: "01", name: "Static Handle Trace", status: "pass", time: "22ms", note: "Tracking 1 active TCP handle" },
      { step: "02", name: "Isolated Health Check", status: "pass", time: "41ms", note: "Socket connects and closes cleanly" },
      { step: "03", name: "Sequential Pipeline Run", status: "fail", time: "192ms", note: "ETIMEDOUT: pool exhausted" },
      { step: "04", name: "Bounded Teardown Patch", status: "pass", time: "33ms", note: "Deterministic handle closure verified" }
    ]
  },
  {
    id: "race-condition",
    name: "Promise Race Desync",
    kicker: "Unawaited Event Hook",
    testFile: "test/event-emitter.test.js",
    failTarget: "test/audit-log.test.js",
    isolationPass: true,
    sequenceFail: true,
    latency: "195ms",
    memoryDelta: "+4.2 MB (Async Pend)",
    diff: `// Synchronize async event pipeline
- emitter.emit('audit.record', payload);
+ await emitter.emitAsync('audit.record', payload);
+ await flushMicrotasks();`,
    steps: [
      { step: "01", name: "Microtask Queue Inspection", status: "pass", time: "14ms", note: "2 floating unawaited promises" },
      { step: "02", name: "Isolated Execution Probe", status: "pass", time: "29ms", note: "Event listeners triggered" },
      { step: "03", name: "Concurrent Replay Probe", status: "fail", time: "124ms", note: "State mismatch: record missing" },
      { step: "04", name: "Awaited Flush Hook", status: "pass", time: "28ms", note: "Ordered event resolution guaranteed" }
    ]
  }
];

export function InteractiveReproducer() {
  const [selectedScenario, setSelectedScenario] = useState(SCENARIOS[0]);
  const [activeTab, setActiveTab] = useState("trace"); // trace | diff | memory
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState(4);

  const triggerReplay = () => {
    setIsRunning(true);
    setRunProgress(0);
    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      setRunProgress(current);
      if (current >= 4) {
        clearInterval(interval);
        setIsRunning(false);
      }
    }, 380);
  };

  return (
    <div className="reproducer-cockpit" id="reproducer">
      {/* Top Scenario Selector Bar */}
      <div className="cockpit-header">
        <div className="scenario-chips">
          {SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              type="button"
              className={`scenario-btn ${selectedScenario.id === sc.id ? "active" : ""}`}
              onClick={() => {
                setSelectedScenario(sc);
                setRunProgress(4);
              }}
            >
              <span className="scenario-dot" />
              <div className="scenario-btn-text">
                <span className="scenario-title">{sc.name}</span>
                <span className="scenario-sub">{sc.kicker}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="cockpit-ctrls">
          <button
            type="button"
            className="btn-replay-trigger"
            onClick={triggerReplay}
            disabled={isRunning}
          >
            <span className={isRunning ? "spinner-anim" : "replay-icon"}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            </span>
            <span>{isRunning ? "Simulating Execution..." : "Replay Sequence"}</span>
          </button>
        </div>
      </div>

      {/* Main Sandbox Window */}
      <div className="cockpit-terminal">
        {/* Terminal Header */}
        <div className="terminal-topbar">
          <div className="terminal-dots">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
          </div>

          <div className="terminal-tabs">
            <button
              type="button"
              className={`terminal-tab ${activeTab === "trace" ? "is-active" : ""}`}
              onClick={() => setActiveTab("trace")}
            >
              Execution Trace ({runProgress}/4)
            </button>
            <button
              type="button"
              className={`terminal-tab ${activeTab === "diff" ? "is-active" : ""}`}
              onClick={() => setActiveTab("diff")}
            >
              Synthesized Patch
            </button>
            <button
              type="button"
              className={`terminal-tab ${activeTab === "memory" ? "is-active" : ""}`}
              onClick={() => setActiveTab("memory")}
            >
              Telemetry Stats
            </button>
          </div>

          <div className="terminal-badges">
            <span className="badge-target">TARGET: {selectedScenario.failTarget}</span>
          </div>
        </div>

        {/* Tab 1: Execution Trace */}
        {activeTab === "trace" && (
          <div className="trace-view">
            <div className="trace-steps-container">
              {selectedScenario.steps.map((st, idx) => {
                const isExecuted = idx < runProgress;
                const isCurrent = idx === runProgress - 1;
                return (
                  <div
                    key={st.step}
                    className={`trace-item ${isExecuted ? "is-done" : "is-pending"} ${st.status === "fail" && isExecuted ? "is-failure" : "is-success"}`}
                  >
                    <div className="trace-col-idx">
                      <span className="trace-step-number">{st.step}</span>
                      {idx < 3 && <div className="trace-connector-line" />}
                    </div>

                    <div className="trace-col-content">
                      <div className="trace-headline">
                        <span className="trace-name">{st.name}</span>
                        <div className="trace-pills">
                          {isExecuted ? (
                            <span className={`pill-status pill-${st.status}`}>
                              {st.status.toUpperCase()}
                            </span>
                          ) : (
                            <span className="pill-status pill-queued">QUEUED</span>
                          )}
                          <span className="trace-time">{isExecuted ? st.time : "—"}</span>
                        </div>
                      </div>
                      <p className="trace-note">
                        {isExecuted ? st.note : "Awaiting runner dispatcher..."}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="trace-summary-footer">
              <div className="summary-col">
                <span className="label">Root Cause Verified</span>
                <span className="val text-cyan">Order-Dependent Mutation</span>
              </div>
              <div className="summary-col">
                <span className="label">Runtime Latency</span>
                <span className="val text-white">{selectedScenario.latency}</span>
              </div>
              <div className="summary-col">
                <span className="label">Memory State Impact</span>
                <span className="val text-magenta">{selectedScenario.memoryDelta}</span>
              </div>
              <div className="summary-col action-col">
                <button
                  type="button"
                  className="btn-inspect-diff"
                  onClick={() => setActiveTab("diff")}
                >
                  Inspect Fix Diff &rarr;
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Synthesized Patch Diff */}
        {activeTab === "diff" && (
          <div className="diff-view-panel">
            <div className="diff-header-line">
              <span className="diff-filepath">PATCH TARGET: {selectedScenario.testFile}</span>
              <span className="diff-badge">VERIFIED BY RE-RUN</span>
            </div>
            <pre className="diff-code-block">
              <code>
                {selectedScenario.diff.split("\n").map((line, lIdx) => {
                  const isAdd = line.startsWith("+");
                  const isDel = line.startsWith("-");
                  return (
                    <div key={lIdx} className={`diff-line ${isAdd ? "line-add" : isDel ? "line-del" : "line-ctx"}`}>
                      <span className="diff-line-number">{lIdx + 1}</span>
                      <span className="diff-line-char">{isAdd ? "+" : isDel ? "-" : " "}</span>
                      <span className="diff-line-code">{line.replace(/^[+-]/, "")}</span>
                    </div>
                  );
                })}
              </code>
            </pre>
          </div>
        )}

        {/* Tab 3: Memory & Telemetry Stats */}
        {activeTab === "memory" && (
          <div className="telemetry-stats-panel">
            <div className="stat-boxes-grid">
              <div className="stat-box">
                <span className="stat-label">Memory Leak Vector</span>
                <span className="stat-big text-cyan">{selectedScenario.memoryDelta}</span>
                <span className="stat-desc">Accumulated state across execution cycles</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Isolated Replay Accuracy</span>
                <span className="stat-big text-emerald">100.0%</span>
                <span className="stat-desc">Zero non-deterministic variance detected</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Cycle Speedup</span>
                <span className="stat-big text-white">4.2x Faster</span>
                <span className="stat-desc">Compared to full CI test suite rerun</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Sandbox Safety Boundary</span>
                <span className="stat-big text-emerald">SECURE_ISOLATE</span>
                <span className="stat-desc">No network or disk mutations persist</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
