"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CheckIcon,
  FolderIcon,
  InfoIcon,
  LockIcon,
  ShieldCheckIcon,
  TerminalIcon
} from "../components/icons";
import { BrandMark, ProductHeader, StatusPill } from "../components/product-chrome";

const demoTimeline = [
  {
    index: "01",
    title: "Connect a project",
    body: "Point Breakpoint at a local directory, or start with the trusted sample.",
    state: "You are here"
  },
  {
    index: "02",
    title: "Run controlled workflow",
    body: "Triage discovers the tests, then the ordered, isolated and repeated runs execute.",
    state: "Up next"
  },
  {
    index: "03",
    title: "Review the evidence",
    body: "Separate what was observed from what is still unknown.",
    state: "Then"
  },
  {
    index: "04",
    title: "Propose & verify",
    body: "Approve a proposed patch and record the rerun result.",
    state: "Then"
  }
];

/** @param {{ label: string, tone: string }} props */
function CardBadge({ label, tone }) {
  return <StatusPill label={label} tone={tone} className="project-badge" />;
}

export default function Onboarding() {
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [root, setRoot] = useState("");
  const [trusted, setTrusted] = useState(false);
  const [stage, setStage] = useState("idle"); // idle | registering | registered | starting
  const [registered, setRegistered] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/projects")
      .then((response) => response.json())
      .then((result) => {
        if (!cancelled && Array.isArray(result.projects)) setProjects(result.projects);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setProjectsLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  async function connectProject(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setStage("registering");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root: root.trim(), trusted })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The project could not be registered.");
      setRegistered(result);
      setStage("registered");
      setNotice(`Discovered ${result.discovery?.testFiles?.length ?? 0} test files — runner: ${result.discovery?.framework === "node" ? "node:test" : result.discovery?.framework}.`);
      const listed = await fetch("/api/projects").then((r) => r.json());
      if (Array.isArray(listed.projects)) setProjects(listed.projects);
    } catch (connectError) {
      setStage("idle");
      setError(connectError instanceof Error ? connectError.message : "The project could not be registered.");
    }
  }

  async function beginInvestigation(projectId) {
    setError("");
    setStage("starting");
    try {
      const response = await fetch("/api/investigations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start-investigation", projectId })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The investigation could not be started.");
      router.push("/dashboard");
    } catch (startError) {
      setStage("idle");
      setError(startError instanceof Error ? startError.message : "The investigation could not be started.");
    }
  }

  const stageLabel = stage === "registering" ? "Registering…" : stage === "starting" ? "Preparing…" : "Ready";

  return (
    <div className="product-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <ProductHeader
        active="projects"
        status={{ label: stageLabel, tone: error ? "error" : "warning" }}
      />

      <main id="main" className="product-main">
        <div className="frame setup-page">
          <header className="page-hero">
            <div className="page-hero-copy">
              <span className="page-kicker">
                Workspace <span aria-hidden="true">/</span> Get started
              </span>
              <h1 className="setup-title">
                Choose a <span className="serif">project</span>.
              </h1>
              <p className="setup-lede">
                Connect a real local directory, or start with the trusted sample. Breakpoint
                reproduces the failure, keeps every finding tied to a recorded run, and leaves the
                fix unapplied until you approve it.
              </p>
            </div>

            <div className="page-stepper" aria-label="Setup progress">
              <span className="page-stepper-label">Setup progress</span>
              <span className="page-stepper-value">
                01 <i aria-hidden="true">/</i> 04
              </span>
              <span className="page-stepper-current">Choose a project</span>
            </div>
          </header>

          <aside className="context-note">
            <span className="context-note-icon" aria-hidden="true">
              <InfoIcon />
            </span>
            <div className="context-note-copy">
              <strong>Runs happen locally with strict execution boundaries.</strong>
              <p>
                Directory registration inspects the local AST to discover tests. Test execution requires
                explicit local trust, and code mutations remain unapplied until you approve the diff.
              </p>
            </div>
            <span className="context-note-meta">Local-first HUD</span>
          </aside>

          <div className="preflight-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginTop: "18px" }}>
            {[
              { label: "Isolation Boundary", status: "Active", desc: "No remote execution", color: "#10b981" },
              { label: "AST Parser", status: "Ready", desc: "Safe static analysis", color: "#38bdf8" },
              { label: "Mutation Gate", status: "Enforced", desc: "Explicit user approval", color: "#f59e0b" },
              { label: "Artifact Store", status: "Encrypted", desc: "Saved to local cache", color: "#8b5cf6" }
            ].map((check) => (
              <div key={check.label} style={{
                background: "rgba(13, 18, 31, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "10px",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "4px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#e2e8f0" }}>{check.label}</span>
                  <span style={{ fontSize: "9px", fontFamily: "var(--mono)", color: check.color, background: `${check.color}18`, padding: "2px 6px", borderRadius: "4px", border: `1px solid ${check.color}33`, textTransform: "uppercase" }}>{check.status}</span>
                </div>
                <span style={{ fontSize: "11px", color: "#64748b" }}>{check.desc}</span>
              </div>
            ))}
          </div>

          <section className="project-section" aria-labelledby="projects-heading">
            <div className="section-rule">
              <h2 id="projects-heading">Select a workspace</h2>
              <span>01 projects available</span>
            </div>

            <div className="project-grid">
                <article className="project-card project-card--primary">
                  <div className="project-card-top">
                    <span className="project-icon" aria-hidden="true">
                      <FolderIcon />
                    </span>
                    <CardBadge label="Built-in sample" tone="neutral" />
                  </div>

                  <h3>Trusted sample project</h3>
                  <p className="project-slug">
                    <span aria-hidden="true">./</span>breakpoint-session-demo
                  </p>
                  <p className="project-description">
                    A small Node project with a real order-dependent test failure. Run it locally,
                    inspect the captured evidence, and take a fix from proposal to recorded
                    verification.
                  </p>

                  <ul className="project-facts" aria-label="Project properties">
                    <li>
                      <CheckIcon /> Node test runner
                    </li>
                    <li>
                      <CheckIcon /> Local execution
                    </li>
                    <li>
                      <CheckIcon /> Approval-gated fixes
                    </li>
                  </ul>

                  <div className="project-card-foot">
                    <button
                      className="btn btn-primary project-cta"
                      type="button"
                      disabled={stage === "starting"}
                      onClick={() => {
                        const demo = projects.find((project) => project.trusted);
                        if (demo) beginInvestigation(demo.id);
                        else router.push("/dashboard");
                      }}
                    >
                      Open sample project
                      <ArrowRightIcon />
                    </button>
                    <span className="project-foot-note">
                      <ShieldCheckIcon />
                      Local, trusted, bundled
                    </span>
                  </div>
                </article>

                <article className="project-card project-card--muted connect-card">
                  <div className="project-card-top">
                    <span className="project-icon project-icon--muted" aria-hidden="true">
                      <TerminalIcon />
                    </span>
                    <CardBadge label="Connect your own" tone="neutral" />
                  </div>

                  <h3>Connect a local project</h3>
                  <p className="project-description">
                    Absolute path to a directory with test files on this machine. Breakpoint
                    discovers the runner and test files; no shell commands are ever accepted from
                    the browser.
                  </p>

                  <form className="config-form connect-form" onSubmit={connectProject}>
                    <label className="form-field">
                      <div className="form-field-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
                        <span style={{ fontSize: "11px", fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>Target directory path</span>
                        <span style={{ fontSize: "10px", fontFamily: "var(--mono)", color: "#0ea5e9" }}>{stage === "registering" ? "SCANNING AST..." : "READY"}</span>
                      </div>
                      <input
                        type="text"
                        inputMode="url"
                        spellCheck={false}
                        autoComplete="off"
                        placeholder="/Users/you/dev/my-project"
                        value={root}
                        onChange={(event) => setRoot(event.target.value)}
                        required
                        style={{
                          background: "rgba(10, 14, 23, 0.8)",
                          border: "1px solid rgba(14, 165, 233, 0.3)",
                          color: "#f8fafc",
                          fontFamily: "var(--mono)",
                          fontSize: "12.5px",
                          borderRadius: "8px",
                          padding: "10px 14px",
                          boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)"
                        }}
                      />
                    </label>

                    <div className="path-presets" style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                      <span style={{ fontSize: "10px", color: "#64748b", fontFamily: "var(--mono)", alignSelf: "center" }}>Quick presets:</span>
                      {["sample-project", "/packages/auth-engine", "/services/telemetry"].map((pathPreset) => (
                        <button
                          key={pathPreset}
                          type="button"
                          onClick={() => setRoot(pathPreset)}
                          style={{
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            color: "#94a3b8",
                            fontSize: "10px",
                            fontFamily: "var(--mono)",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            cursor: "pointer"
                          }}
                        >
                          {pathPreset}
                        </button>
                      ))}
                    </div>

                    <label className="trust-check" style={{ marginTop: "14px", display: "flex", gap: "10px", alignItems: "flex-start", cursor: "pointer" }}>
                      <input type="checkbox" checked={trusted} onChange={(event) => setTrusted(event.target.checked)} style={{ marginTop: "3px", accentColor: "#0ea5e9" }} />
                      <span style={{ fontSize: "11.5px", color: "#94a3b8", lineHeight: "1.5" }}>
                        Trust this directory: allow Breakpoint to execute test runners locally and inspect execution state safely.
                      </span>
                    </label>
                    <div className="connect-actions" style={{ marginTop: "16px", display: "flex", gap: "10px" }}>
                      <button className="btn btn-secondary project-cta" type="submit" disabled={stage !== "idle" && stage !== "registered"}>
                        {stage === "registering" ? "Scanning files…" : registered ? "Re-scan directory" : "Scan & connect"}
                      </button>
                      {registered && stage !== "starting" ? (
                        <button className="btn btn-primary project-cta" type="button" onClick={() => beginInvestigation(registered.project.id)}>
                          Start investigation
                          <ArrowRightIcon />
                        </button>
                      ) : null}
                    </div>
                  </form>

                  {registered ? (
                    <p className="connect-result" role="status">
                      <CheckIcon /> {registered.project.name} · {registered.discovery?.framework === "node" ? "node:test" : registered.discovery?.framework} ·{" "}
                      {registered.discovery?.testFiles?.length ?? 0} test files
                      {registered.discovery?.truncated ? " (file list truncated)" : ""}
                    </p>
                  ) : null}
                  {notice ? <p className="connect-result">{notice}</p> : null}
                  {error ? <p className="connect-result connect-result--error" role="alert">{error}</p> : null}

                  <span className="project-foot-note">
                    <LockIcon />
                    Runs need the trust confirmation above
                  </span>
                </article>
              </div>
          </section>

          {projectsLoaded && projects.length > 1 ? (
            <section className="project-section" aria-labelledby="registered-heading">
              <div className="section-rule">
                <h2 id="registered-heading">Connected projects</h2>
                <span>Everything registered on this machine</span>
              </div>
              <p className="registered-lede">
                Each entry keeps its own investigations and evidence trail in the local store.
              </p>
              <ul className="registered-list">
                {projects.map((project) => (
                  <li key={project.id} className="registered-item">
                    <div>
                      <strong>{project.name}</strong>
                      <code>{project.root}</code>
                    </div>
                    <div className="registered-meta">
                      <StatusPill label={project.trusted ? "Trusted" : "Untrusted"} tone={project.trusted ? "neutral" : "warning"} />
                      <span>{project.framework === "node" ? "node:test" : project.framework}</span>
                      <span>{project.testFiles?.length ?? 0} test files</span>
                      <button
                        className="btn btn-secondary"
                        type="button"
                        disabled={stage === "starting"}
                        onClick={() => beginInvestigation(project.id)}
                      >
                        Investigate
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="journey-section" aria-labelledby="journey-heading">
            <div className="journey-head">
              <div>
                <span className="page-kicker">The workflow</span>
                <h2 id="journey-heading">One recorded trail, from failure to fix.</h2>
              </div>
              <p>
                Each step produces an artifact you can inspect. No diagnosis is promoted to fact
                without run evidence behind it.
              </p>
            </div>

            <ol className="journey-steps">
              {demoTimeline.map((step, index) => (
                <li className={`journey-step ${index === 0 ? "is-current" : ""}`.trim()} key={step.index}>
                  <div className="journey-step-top">
                    <span className="journey-step-index">{step.index}</span>
                    <span className="journey-step-state">{step.state}</span>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <footer className="product-page-foot">
            <p>
              Trusted local runs <span aria-hidden="true">·</span> no secrets{" "}
              <span aria-hidden="true">·</span> review before apply
            </p>
            <Link className="product-foot-link" href="/#workflow">
              How Breakpoint works
              <ArrowUpRightIcon />
            </Link>
          </footer>

          <div className="product-signoff" aria-hidden="true">
            <BrandMark />
          </div>
        </div>
      </main>
    </div>
  );
}
