"use client";

import { useState } from "react";

const steps = [
  ["01", "Reproduce", "Run the test under a controlled, inspectable condition."],
  ["02", "Compare", "Put passing and failing runs next to each other."],
  ["03", "Investigate", "Separate evidence from possible explanations."],
  ["04", "Verify", "Record what happened after a proposed change."]
];

function Mark() {
  return <span className="mark" aria-hidden="true"><i /><i /><i /></span>;
}

export default function LandingPage() {
  const [menu, setMenu] = useState(false);
  const [tab, setTab] = useState<"evidence" | "comparison">("evidence");

  return <div className="site">
    <header className="nav">
      <div className="frame nav-inner">
        <a className="wordmark" href="#top"><Mark />Breakpoint</a>
        <nav className={menu ? "nav-links open" : "nav-links"}>
          <a href="#workflow" onClick={() => setMenu(false)}>Workflow</a>
          <a href="#evidence" onClick={() => setMenu(false)}>Evidence</a>
          <a href="#principle" onClick={() => setMenu(false)}>Principles</a>
        </nav>
        <a className="nav-cta" href="#demo">View demo <span>→</span></a>
        <button className="menu" aria-label="Toggle menu" onClick={() => setMenu(!menu)}>{menu ? "×" : "☰"}</button>
      </div>
    </header>

    <main>
      <section className="hero frame" id="top">
        <div className="hero-copy">
          <p className="kicker"><span /> Evidence-first debugging</p>
          <h1>Don&apos;t guess the bug.<br /> <em>Prove</em> it.</h1>
        </div>
        <div className="hero-side">
          <p>Breakpoint gives inconsistent test failures a structured investigation: reproduce the condition, compare the evidence, test the hypothesis, and verify the result.</p>
          <div className="hero-actions"><a className="button secondary" href="#workflow">Explore workflow <span>↓</span></a><a className="button primary" href="#demo">See the investigation <span>→</span></a></div>
        </div>
      </section>

      <section className="product-wrap frame" id="demo">
        <p className="fixture-label">Illustrative product view · seeded demo data</p>
        <div className="product-window">
          <aside className="console-rail"><Mark /><span className="rail-active">⌘</span><span>◈</span><span>≡</span><span>◌</span></aside>
          <div className="console">
            <div className="console-bar"><div><span className="subtle">Investigation</span><b>INV-0042</b><span className="slash">/</span><strong>Session state persists between tests</strong></div><span className="demo-live"><i /> DEMO</span></div>
            <div className="console-body">
              <aside className="investigation-nav"><p>WORKSPACE</p><div className="selected">Overview</div><div>Run comparison</div><div>Evidence</div><div>Fix review</div><hr /><p>STATUS</p><b className="review">● Needs review</b><span>Updated just now</span></aside>
              <section className="investigation-main">
                <div className="console-tabs"><button className={tab === "evidence" ? "active" : ""} onClick={() => setTab("evidence")}>Evidence</button><button className={tab === "comparison" ? "active" : ""} onClick={() => setTab("comparison")}>Run comparison</button><span>test/session.test.ts</span></div>
                {tab === "evidence" ? <EvidencePanel /> : <ComparisonPanel />}
              </section>
            </div>
          </div>
        </div>
      </section>

      <section className="strip"><div className="frame"><span>Local workspace</span><span>Node test runner</span><span>Structured evidence</span><span>Reviewable fixes</span><span>Real verification</span></div></section>

      <section className="intro frame" id="evidence">
        <p className="section-number">01 / THE PROBLEM</p>
        <div><h2>Tests can pass alone<br />and fail in <em>context.</em></h2><p>When a test fails only under a particular order or environment, a log dump is not enough. You need a record of what actually changed between runs.</p></div>
      </section>

      <section className="workflow frame" id="workflow">
        <div className="workflow-head"><p className="section-number">02 / THE WORKFLOW</p><p>One investigation, from first failure to documented result.</p></div>
        <div className="steps">{steps.map(([number, title, text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p><b>↘</b></article>)}</div>
      </section>

      <section className="evidence-section" id="principle"><div className="frame evidence-layout">
        <div><p className="section-number">03 / A BETTER CLAIM</p><h2>Every conclusion<br />should show its <em>work.</em></h2></div>
        <div className="claim-list"><article><span className="claim observed">Observed</span><div><h3>What the run data directly shows</h3><p>Execution order, exit codes, captured output, and configuration are facts when the runner records them.</p></div></article><article><span className="claim hypothesis">Hypothesis</span><div><h3>What may explain those facts</h3><p>Potential causes remain explicitly uncertain until a targeted test can support or reject them.</p></div></article><article><span className="claim unknown">Unknown</span><div><h3>What has not been established</h3><p>Breakpoint keeps gaps visible so a plausible story does not become a false root cause.</p></div></article></div>
      </div></section>

      <section className="quote frame"><p>“The useful debugging tool isn&apos;t the one that sounds most certain. It&apos;s the one that makes the evidence impossible to ignore.”</p><span>BREAKPOINT PRINCIPLE</span></section>

      <section className="final frame"><div><p className="section-number">READY TO INVESTIGATE</p><h2>Make the next failure<br /><em>legible.</em></h2></div><a className="button primary large" href="#top">Start with the evidence <span>→</span></a></section>
    </main>

    <footer><div className="frame"><a className="wordmark" href="#top"><Mark />Breakpoint</a><p>Evidence-first debugging, powered by Codex.</p><a href="#top">Back to top ↑</a></div></footer>
  </div>;
}

function EvidencePanel() {
  return <div className="evidence-panel"><div className="panel-heading"><div><p>RUN EVIDENCE</p><h3>Shared state may survive the auth test</h3></div><span className="uncertain">LOW–MEDIUM CONFIDENCE</span></div><div className="findings"><div><span className="claim observed">Observed</span><p>The failing fixture runs <code>auth.test.ts</code> before <code>session.test.ts</code>.</p></div><div><span className="claim observed">Observed</span><p>Only the failing output contains <code>demo-user-1</code> before session setup.</p></div><div><span className="claim hypothesis">Hypothesis</span><p>Module-level session state may not be cleared after authentication tests.</p></div></div><div className="command-line"><span>›</span> node --test test/*.test.ts <b>exit 1</b></div></div>;
}

function ComparisonPanel() {
  return <div className="comparison-panel"><div className="run-columns"><article><div><span className="red-dot" /> FAILING RUN</div><h3>run_0184</h3><p>auth → session</p><code>exit 1 · 842 ms</code></article><article><div><span className="green-dot" /> PASSING RUN</div><h3>run_0181</h3><p>session only</p><code>exit 0 · 314 ms</code></article></div><div className="diff"><span>Relevant difference</span><b>The auth test precedes the session test only in the failing fixture.</b></div></div>;
}
