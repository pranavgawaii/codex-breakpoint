"use client";

import { useState } from "react";
import Link from "next/link";
import { ModernNav } from "./components/modern-nav";
import { InteractiveReproducer } from "./components/interactive-reproducer";
import { ModernFooter } from "./components/modern-footer";

const FAILURE_VECTORS = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
      </svg>
    ),
    badge: "STATE MUTATION",
    title: "Order-Dependent Pollution",
    desc: "A predecessor test mutates a shared singleton or database cache, causing downstream tests to fail only when executed in declared order.",
    metric: "42% of CI Flakes"
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    badge: "ASYNC DRIFT",
    title: "Lingering Socket Handles",
    desc: "Unclosed HTTP connection pools, active database timers, and unawaited microtasks that cause silent memory starvation across worker threads.",
    metric: "0 Leaked Handles"
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    badge: "CONCURRENCY",
    title: "Race Condition Desync",
    desc: "Interleaved asynchronous promises that succeed on fast developer laptops but consistently desynchronize under constrained CI core allocations.",
    metric: "100% Replay Fidelity"
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="9" y1="3" x2="9" y2="21" />
      </svg>
    ),
    badge: "AUTOMATION",
    title: "Automated Flake Bisection",
    desc: "Binary search AST permutation algorithm that pinpoints the exact offending test pair in 4 runs rather than rerunning the whole test suite.",
    metric: "4.8x Faster Triage"
  }
];

const PIPELINE_STAGES = [
  {
    num: "01",
    phase: "SCAN & CAPTURE",
    title: "Static AST Shared-State Extraction",
    body: "Scans project test files without executing untrusted code. Discovers singletons, global bindings, mock registries, and runner framework hooks."
  },
  {
    num: "02",
    phase: "ISOLATE TARGET",
    title: "Pure Zero-Pollution Execution",
    body: "Executes the failing test target in complete process isolation with a scrubbed environment to prove whether the failure is intrinsic or order-dependent."
  },
  {
    num: "03",
    phase: "PERMUTATION BISECT",
    title: "Ordered Predecessor Bisection",
    body: "Replays pairwise execution matrices to pinpoint the exact predecessor file and test case that corrupts the shared runtime memory."
  },
  {
    num: "04",
    phase: "VERIFY & CERTIFY",
    title: "Cryptographic Patch Verification",
    body: "Proposes an explicit teardown cleanup patch. Keeps code untouched until approved, then records rerun telemetry to produce an immutable audit certificate."
  }
];

const COMPARISON_ROWS = [
  {
    feature: "Failure Diagnosis Method",
    legacy: "Reading 4,000 lines of raw unstructured console logs",
    breakpoint: "Structured evidence graph linking memory delta to test pair"
  },
  {
    feature: "Flakiness Handling",
    legacy: "Rerunning the suite 3 times hoping it passes ('retry flake')",
    breakpoint: "Deterministic order-bisection proving exact polluting mutation"
  },
  {
    feature: "Code Mutation Safety",
    legacy: "AI agents silently modifying code without audit trail",
    breakpoint: "Approval-gated diffs with cryptographic verification certificate"
  },
  {
    feature: "Execution Environment",
    legacy: "Sending codebase and secrets to third-party cloud LLMs",
    breakpoint: "100% local-first runner with zero network exfiltration"
  }
];

export default function Home() {
  const [copied, setCopied] = useState(false);

  const copyCommand = () => {
    navigator.clipboard.writeText("npx breakpoint verify --isolated");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modern-page-root" id="top">
      <ModernNav />

      {/* Hero Section */}
      <section className="modern-hero-section">
        <div className="hero-radial-glow" aria-hidden="true" />
        <div className="modern-container hero-container">
          <div className="hero-badge-pill">
            <span className="badge-glow-dot" />
            <span className="badge-text">DETERMINISTIC TEST RUNTIME · KERNEL SPEED</span>
            <span className="badge-tag">ENGINE v2.4</span>
          </div>

          <h1 className="hero-giant-title">
            Tame Flaky Tests With <br />
            <span className="hero-warm-accent">Cryptographic Isolation.</span>
          </h1>

          <p className="hero-description">
            Stop rerunning failing CI jobs and guessing. Breakpoint captures dirty runtime memory, bisects execution order permutations, and delivers an immutable evidence trail for intermittent bugs.
          </p>

          <div className="hero-action-row">
            <Link href="/app" className="btn-hero-primary">
              <span>Launch Studio</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>

            <div className="cli-command-pill" onClick={copyCommand} role="button" tabIndex={0}>
              <span className="cli-prompt">$</span>
              <code className="cli-code">npx breakpoint verify --isolated</code>
              <button type="button" className="cli-copy-btn" aria-label="Copy CLI Command">
                {copied ? (
                  <span className="copy-success">COPIED</span>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Metric Bar */}
          <div className="hero-metrics-bar">
            <div className="metric-item">
              <span className="metric-val text-cyan">100%</span>
              <span className="metric-lbl">Deterministic Replay</span>
            </div>
            <div className="metric-item">
              <span className="metric-val text-emerald">0.00s</span>
              <span className="metric-lbl">State Exfiltration</span>
            </div>
            <div className="metric-item">
              <span className="metric-val text-white">4.8x</span>
              <span className="metric-lbl">Faster Bisection</span>
            </div>
            <div className="metric-item">
              <span className="metric-val text-cyan">Node & Py</span>
              <span className="metric-lbl">Native Runners</span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Simulator Section */}
      <section className="section-reproducer">
        <div className="modern-container">
          <div className="section-head text-center">
            <span className="section-eyebrow">INTERACTIVE SANDBOX SIMULATOR</span>
            <h2 className="section-title">Experience Deterministic Failure Isolation</h2>
            <p className="section-subtitle">
              Choose a failure mode below and execute an isolated verification sequence in real-time. Watch the runner detect state pollution, calculate memory delta, and synthesize an approval-ready patch.
            </p>
          </div>

          <InteractiveReproducer />
        </div>
      </section>

      {/* Failure Modes Bento Grid */}
      <section className="section-failures" id="failures">
        <div className="modern-container">
          <div className="section-head">
            <span className="section-eyebrow">DIAGNOSTIC CAPABILITIES</span>
            <h2 className="section-title">Failure Vectors Breakpoint Eliminates</h2>
            <p className="section-subtitle">
              Traditional testing suites assume tests are pure functions. Distributed applications leak state. Breakpoint captures the boundary between what was observed and what was dirty.
            </p>
          </div>

          <div className="failures-bento-grid">
            {FAILURE_VECTORS.map((fv) => (
              <div key={fv.title} className="failure-card">
                <div className="failure-card-top">
                  <div className="failure-icon-wrap">{fv.icon}</div>
                  <span className="failure-badge">{fv.badge}</span>
                </div>
                <h3 className="failure-title">{fv.title}</h3>
                <p className="failure-desc">{fv.desc}</p>
                <div className="failure-card-foot">
                  <span className="failure-metric">{fv.metric}</span>
                  <span className="failure-link-hint">Automated Detection &rarr;</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4-Stage Architecture Pipeline */}
      <section className="section-architecture" id="architecture">
        <div className="modern-container">
          <div className="section-head text-center">
            <span className="section-eyebrow">EXECUTION ARCHITECTURE</span>
            <h2 className="section-title">The Deterministic Replay Pipeline</h2>
            <p className="section-subtitle">
              Four hermetic stages that turn a mysterious intermittent failure into a verified cryptographic certificate of resolution.
            </p>
          </div>

          <div className="pipeline-grid">
            {PIPELINE_STAGES.map((ps) => (
              <div key={ps.num} className="pipeline-card">
                <div className="pipeline-num-badge">{ps.num}</div>
                <span className="pipeline-phase">{ps.phase}</span>
                <h3 className="pipeline-title">{ps.title}</h3>
                <p className="pipeline-body">{ps.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Matrix */}
      <section className="section-matrix" id="matrix">
        <div className="modern-container">
          <div className="section-head">
            <span className="section-eyebrow">EMPIRICAL COMPARISON</span>
            <h2 className="section-title">Standard CI Log Dumps vs. Breakpoint</h2>
            <p className="section-subtitle">
              Why blind retries and text log dumps fail to solve flaky tests, and how deterministic isolation solves them permanently.
            </p>
          </div>

          <div className="matrix-table-wrap">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th className="th-feature">DIAGNOSTIC CAPABILITY</th>
                  <th className="th-legacy">CONVENTIONAL CI LOG DUMPS</th>
                  <th className="th-bp">BREAKPOINT RUNTIME</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.feature}>
                    <td className="td-feature">{row.feature}</td>
                    <td className="td-legacy">
                      <span className="cross-icon">&#10005;</span> {row.legacy}
                    </td>
                    <td className="td-bp">
                      <span className="check-icon">&#10003;</span> {row.breakpoint}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Engineering Manifesto Banner */}
      <section className="section-manifesto">
        <div className="modern-container">
          <div className="manifesto-card">
            <span className="manifesto-badge">ENGINEERING CORE PRINCIPLE</span>
            <blockquote className="manifesto-quote">
              &ldquo;A log dump is not evidence. A plausible hypothesis is not a root cause. No diagnosis should be promoted to fact without an isolated recorded run to prove it.&rdquo;
            </blockquote>
            <div className="manifesto-author">
              <span className="author-name">Breakpoint Core Runtime Specification</span>
              <span className="author-sub">Deterministic Systems Working Group &middot; Apache 2.0</span>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Cockpit */}
      <section className="section-cta">
        <div className="modern-container">
          <div className="cta-cockpit-box">
            <div className="cta-mesh-glow" aria-hidden="true" />
            <span className="cta-kicker">MISSION CONTROL</span>
            <h2 className="cta-headline">Ready To Eliminate Flakiness Forever?</h2>
            <p className="cta-body">
              Connect your local repository, inspect order-dependent failures, and generate verified digital fix certificates right now. 100% local-first on your machine.
            </p>

            <div className="cta-buttons-row">
              <Link href="/app" className="btn-hero-primary">
                Open Workspace Studio &rarr;
              </Link>
              <Link href="/dashboard" className="btn-cta-secondary">
                Inspect Sample Investigation
              </Link>
            </div>
          </div>
        </div>
      </section>

      <ModernFooter />
    </div>
  );
}
