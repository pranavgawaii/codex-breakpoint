"use client";

import { useState } from "react";

type Status = "Failing" | "Passing" | "Needs review";
type EvidenceKind = "Observed" | "Hypothesis" | "Unknown";

type TestRun = {
  id: string; status: Status; exitCode: number; order: string; command: string; duration: string; output: string;
};

const runs: TestRun[] = [
  { id: "run_0184", status: "Failing", exitCode: 1, order: "auth → session", command: "node --test test/session.test.ts", duration: "842 ms", output: "Expected session.user to be undefined\nReceived: { id: 'demo-user-1' }\n\n✖ clears session before each test" },
  { id: "run_0181", status: "Passing", exitCode: 0, order: "session only", command: "node --test test/session.test.ts", duration: "314 ms", output: "✔ clears session before each test\n✔ returns an anonymous session\n\n2 passing" }
];

const evidence: { kind: EvidenceKind; text: string }[] = [
  { kind: "Observed", text: "The failing run executes auth.test.ts before session.test.ts; the passing run executes session.test.ts alone." },
  { kind: "Observed", text: "Failing output contains a persisted demo-user-1 value before the session test begins." },
  { kind: "Hypothesis", text: "auth.test.ts may leave module-level session state populated between tests." },
  { kind: "Unknown", text: "Whether the same behavior occurs in a clean worker or under the production test configuration is not established." }
];

const nav = ["Workspace", "Investigations", "Test Runs", "Evidence Reports", "Settings"];

function StatusBadge({ status }: { status: Status }) {
  return <span className={`status ${status.toLowerCase().replace(" ", "-")}`}><i />{status}</span>;
}

function Sidebar({ active, onSelect }: { active: string; onSelect: (item: string) => void }) {
  return <aside className="sidebar">
    <div className="brand"><span className="brandmark">B</span><span>Breakpoint</span></div>
    <div className="workspace-switch"><span className="dot" />demo-session-app <span className="chevron">⌄</span></div>
    <nav>{nav.map((item) => <button key={item} onClick={() => onSelect(item)} className={active === item ? "active" : ""}><span className="nav-icon">{item === "Workspace" ? "⌘" : item === "Investigations" ? "◉" : item === "Test Runs" ? "≡" : item === "Evidence Reports" ? "▤" : "⚙"}</span>{item}</button>)}</nav>
    <div className="sidebar-bottom"><span className="demo-chip">DEMO DATA</span><p>Local workspace<br /><span>No runner connected</span></p></div>
  </aside>;
}

function Dashboard({ onInvestigate }: { onInvestigate: () => void }) {
  return <main className="content">
    <div className="page-head"><div><p className="eyebrow">WORKSPACE / DEMO PROJECT</p><h1>Good afternoon, developer.</h1><p className="muted">Evidence-first debugging for <code>demo-session-app</code>.</p></div><button className="primary" onClick={onInvestigate}>+ Start investigation</button></div>
    <div className="notice"><span>◇</span><div><strong>Demo workspace</strong><p>All runs, logs, and findings below are seeded fixtures — no tests have been executed.</p></div></div>
    <section className="metrics"><article><span>Open investigations</span><strong>01</strong><small>1 needs review</small></article><article><span>Unresolved failures</span><strong>01</strong><small>From demo run history</small></article><article><span>Recorded test runs</span><strong>02</strong><small>Seeded comparison pair</small></article></section>
    <section className="grid"><div className="panel wide"><div className="panel-head"><div><h2>Recent investigations</h2><p>Structured debugging workspaces</p></div><button className="text-button" onClick={onInvestigate}>View all →</button></div><button className="investigation-row" onClick={onInvestigate}><span className="failure-marker" /><div><strong>Session state persists between tests</strong><p>test/session.test.ts · Updated just now</p></div><StatusBadge status="Needs review" /><span>→</span></button></div>
      <div className="panel"><div className="panel-head"><div><h2>Run activity</h2><p>Most recent demo fixtures</p></div></div>{runs.map(run => <div className="run-row" key={run.id}><StatusBadge status={run.status} /><span>{run.id}</span><small>{run.duration}</small></div>)}</div></section>
  </main>;
}

function EvidenceList() {
  return <div className="evidence-list">{evidence.map((item, i) => <div className="evidence-item" key={i}><span className={`evidence-tag ${item.kind.toLowerCase()}`}>{item.kind}</span><p>{item.text}</p></div>)}</div>;
}

function Investigation({ onCompare }: { onCompare: () => void }) {
  return <main className="content">
    <div className="crumb">INVESTIGATIONS <span>/</span> INV-0042</div>
    <div className="page-head compact"><div><div className="title-line"><h1>Session state persists between tests</h1><StatusBadge status="Needs review" /></div><p className="muted">demo-session-app · <code>test/session.test.ts</code></p></div><button className="primary" onClick={onCompare}>Compare runs</button></div>
    <div className="notice"><span>◇</span><div><strong>Seeded demo investigation</strong><p>This workspace presents fixture data only. No diagnosis, patch, or verification has been performed.</p></div></div>
    <section className="investigation-grid"><div><div className="panel"><div className="panel-head"><div><h2>Run history</h2><p>Contrasting fixture records</p></div><button className="text-button" onClick={onCompare}>Open comparison →</button></div>{runs.map(run => <button className="run-card" onClick={onCompare} key={run.id}><StatusBadge status={run.status}/><div><strong>{run.id}</strong><p>{run.order} · {run.duration}</p></div><code>exit {run.exitCode}</code></button>)}</div>
      <div className="panel spaced"><p className="eyebrow">EXECUTION METADATA</p><dl><dt>Command</dt><dd><code>node --test test/*.test.ts</code></dd><dt>Environment</dt><dd>Node 22 · local fixture</dd><dt>Repository</dt><dd>demo-session-app</dd></dl></div></div>
      <div><div className="panel"><div className="panel-head"><div><h2>Evidence</h2><p>Claims separated by certainty</p></div></div><EvidenceList /></div>
      <div className="panel diagnosis"><p className="eyebrow">DIAGNOSIS</p><h2>Potential shared-state leak</h2><p>Available evidence is consistent with state surviving after the auth test, but this has not been established as the root cause.</p><div className="confidence"><span>Confidence</span><b>Low–medium</b></div></div></div>
    <section className="panel fix-preview"><div><div className="panel-head"><div><h2>Proposed fix & verification</h2><p>Review interface for future runner integration</p></div><span className="empty-badge">NOT VERIFIED</span></div><div className="empty"><span>⌘</span><strong>No patch has been applied</strong><p>A suggested diff and rerun result will appear here when an integration provides them.</p></div></div></section>
  </main>;
}

function Comparison({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<"summary" | "logs">("summary");
  return <main className="content">
    <div className="crumb"><button onClick={onBack}>INVESTIGATIONS</button> <span>/</span> RUN COMPARISON</div>
    <div className="page-head compact"><div><h1>Compare test runs</h1><p className="muted">Fixture data from the demo investigation</p></div><div className="segmented"><button className={mode === "summary" ? "selected" : ""} onClick={() => setMode("summary")}>Summary</button><button className={mode === "logs" ? "selected" : ""} onClick={() => setMode("logs")}>Output & logs</button></div></div>
    <div className="notice"><span>◇</span><div><strong>Captured-output simulation</strong><p>Values are static demo fixtures, not live test execution.</p></div></div>
    <section className="compare-grid">{runs.map(run => <div className="panel run-column" key={run.id}><div className="run-title"><div><p className="eyebrow">{run.id}</p><h2>{run.status === "Failing" ? "Failure case" : "Control case"}</h2></div><StatusBadge status={run.status}/></div><dl><dt>Exit code</dt><dd>{run.exitCode}</dd><dt>Execution order</dt><dd>{run.order}</dd><dt>Command</dt><dd><code>{run.command}</code></dd><dt>Duration</dt><dd>{run.duration}</dd></dl>{mode === "logs" && <pre>{run.output}</pre>}</div>)}</section>
    <section className="panel differences"><div className="panel-head"><div><h2>Relevant differences</h2><p>Derived from the displayed demo fixtures</p></div></div><div className="diff-row"><span>Execution order</span><b>auth runs before session only in the failing fixture</b></div><div className="diff-row"><span>Initial session value</span><b>demo-user-1 is present only in failing output</b></div><div className="diff-row"><span>Result</span><b>Exit 1 vs exit 0</b></div></section>
  </main>;
}

export default function App() {
  const [active, setActive] = useState("Workspace");
  const [screen, setScreen] = useState<"dashboard" | "investigation" | "comparison">("dashboard");
  const go = (item: string) => { setActive(item); setScreen(item === "Workspace" ? "dashboard" : item === "Investigations" ? "investigation" : "dashboard"); };
  return <div className="app-shell"><Sidebar active={active} onSelect={go}/>{screen === "dashboard" ? <Dashboard onInvestigate={() => { setActive("Investigations"); setScreen("investigation"); }}/> : screen === "investigation" ? <Investigation onCompare={() => setScreen("comparison")}/> : <Comparison onBack={() => setScreen("investigation")}/>}</div>;
}
