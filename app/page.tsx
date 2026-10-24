"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { InvestigationSnapshot } from "@/lib/models";
import { Mark } from "./components/brand-mark";
import { InvestigationWindow } from "./components/investigation-window";
import { SiteFooter } from "./components/site-footer";

const navLinksLeft = [
  { label: "Workflow", href: "#workflow" },
  { label: "Evidence", href: "#evidence" }
];

const navLinksRight = [
  { label: "Principles", href: "#principles" },
  { label: "Live demo", href: "#demo" }
];

const mobileLinks = [...navLinksLeft, ...navLinksRight];

const stages = ["Reproduce", "Compare", "Investigate", "Propose", "Verify"];

const problemCards = [
  {
    kicker: "What it is",
    title: "A structured investigation.",
    body: "Breakpoint turns an inconsistent failure into a sequence of recorded runs, linked evidence and a bounded hypothesis."
  },
  {
    kicker: "Why it matters",
    title: "A log dump is not evidence.",
    body: "Output without a run identity or a comparison makes a plausible story feel like a root cause. Breakpoint keeps that boundary visible."
  },
  {
    kicker: "How to explore",
    title: "Run the controlled comparison.",
    body: "Use the live local demo to execute two Node tests, then inspect the evidence and comparison views without leaving the page."
  }
];

const workflowSteps = [
  {
    label: "Reproduce",
    title: "Run the test under a controlled condition.",
    body: "Breakpoint records the command, working directory, duration, exit code and captured output, so the failure has a fixed point to reason from.",
    inOut: "a failing test in → two recorded runs out"
  },
  {
    label: "Compare",
    title: "Put the passing and failing runs side by side.",
    body: "Execution order, exit codes, output and environment metadata are compared directly. Only differences tied to stored run evidence become findings.",
    inOut: "two recorded runs in → observed differences out"
  },
  {
    label: "Investigate",
    title: "Separate evidence from explanation.",
    body: "Every finding stays labelled as observed. Every potential cause is a hypothesis, with its supporting evidence and open questions stated plainly.",
    inOut: "observed findings in → a bounded hypothesis out"
  },
  {
    label: "Verify",
    title: "Record what happened after the change.",
    body: "A proposed fix requires explicit approval before it is applied. Verification is not a promise; it is the result of rerunning the test and recording the actual outcome.",
    inOut: "a reviewable patch in → a recorded result out"
  }
];

const otherTools = [
  "Scattered output with no run identity",
  "Passing and failing runs impossible to line up",
  "A plausible cause stated as fact",
  "A proposed fix that is never tested again"
];

const breakpoint = [
  "Every finding linked to a recorded run",
  "Passing and failing runs compared directly",
  "Observed, hypothesis and unknown kept apart",
  "Verification recorded by rerunning the test"
];

const nextSteps = [
  { label: "Open the live demo", href: "#demo" },
  { label: "Run the controlled tests", href: "#demo" },
  { label: "Compare the recorded evidence", href: "#demo" }
];

function Reveal({
  children,
  delay = 0,
  className = "",
  id
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { root: null, rootMargin: "0px", threshold: 0.12 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      id={id}
      data-reveal={visible ? "visible" : "pending"}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`.trim()}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ---------- Hero ambient visual ---------- */

const heroFragments = [
  { text: "exit 0", x: "8%",  y: "18%", delay: 0,    size: 11 },
  { text: "exit 1", x: "82%", y: "22%", delay: 1.2,  size: 11 },
  { text: "run_0184",   x: "14%", y: "62%", delay: 2.1,  size: 10 },
  { text: "observed",   x: "76%", y: "68%", delay: 0.6,  size: 10 },
  { text: "hypothesis", x: "88%", y: "42%", delay: 3.0,  size: 9.5 },
  { text: "ev_1042",    x: "6%",  y: "40%", delay: 1.8,  size: 10 },
  { text: "compare",    x: "68%", y: "12%", delay: 0.9,  size: 10 },
  { text: "verified",   x: "24%", y: "78%", delay: 2.6,  size: 10.5 },
  { text: "--test",     x: "52%", y: "82%", delay: 3.4,  size: 10 },
  { text: "diff",       x: "38%", y: "10%", delay: 1.5,  size: 11 },
];

const heroParticles = Array.from({ length: 18 }, (_, i) => ({
  x: `${5 + ((i * 53) % 90)}%`,
  y: `${8 + ((i * 37) % 84)}%`,
  delay: (i * 0.7) % 5,
  size: 2 + (i % 3),
}));

function HeroVisual() {
  return (
    <div className="hero-visual" aria-hidden="true">
      {/* Radial ambient glow */}
      <div className="hero-glow hero-glow--primary" />
      <div className="hero-glow hero-glow--secondary" />

      {/* Grid overlay */}
      <div className="hero-grid-overlay" />

      {/* Floating code fragments */}
      {heroFragments.map((frag) => (
        <span
          key={frag.text}
          className="hero-frag"
          style={{
            left: frag.x,
            top: frag.y,
            fontSize: `${frag.size}px`,
            animationDelay: `${frag.delay}s`,
          }}
        >
          {frag.text}
        </span>
      ))}

      {/* Particles */}
      {heroParticles.map((p, i) => (
        <span
          key={i}
          className="hero-particle"
          style={{
            left: p.x,
            top: p.y,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      {/* Connecting lines */}
      <svg className="hero-lines" viewBox="0 0 1200 600" preserveAspectRatio="none">
        <path d="M100,100 Q400,50 600,200 T1100,150" className="hero-line" style={{ animationDelay: "0s" }} />
        <path d="M50,300 Q300,250 500,400 T1050,350"  className="hero-line" style={{ animationDelay: "1.5s" }} />
        <path d="M200,450 Q500,380 700,500 T1150,420" className="hero-line" style={{ animationDelay: "3s" }} />
      </svg>
    </div>
  );
}

function StageSet() {
  return (
    <div className="marquee-set">
      {stages.map((stage) => (
        <span key={stage} className={stage === "Verify" ? "accent" : undefined}>
          {stage}
        </span>
      ))}
    </div>
  );
}

function StepVisual({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className="step-visual">
        <div className="step-visual-head">
          <span className="step-visual-dot" aria-hidden="true" />
          <span className="mono-label">Run pair · controlled</span>
          <span className="step-visual-tag">2 executions</span>
        </div>
        <div className="step-visual-body">
          <div className="run-row">
            <span className="run-state pass">Pass</span>
            <div>
              <b>session-flow.test.js</b>
              <small>isolated · 182 ms</small>
            </div>
            <code>exit 0</code>
          </div>
          <div className="run-row">
            <span className="run-state fail">Fail</span>
            <div>
              <b>ordered-suite.test.js</b>
              <small>after auth · 241 ms</small>
            </div>
            <code>exit 1</code>
          </div>
          <div className="mini-terminal">
            <span aria-hidden="true">›</span>
            <span>node --test test/session-flow.test.js</span>
            <b>recorded</b>
          </div>
        </div>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className="step-visual">
        <div className="step-visual-head">
          <span className="step-visual-dot" aria-hidden="true" />
          <span className="mono-label">Run comparison</span>
          <span className="step-visual-tag">run_0184 vs run_0181</span>
        </div>
        <div className="step-visual-body">
          <div className="diff-row">
            <span>Execution order</span>
            <b>differs</b>
          </div>
          <div className="diff-row">
            <span>Auth state</span>
            <b>retained</b>
          </div>
          <div className="diff-row">
            <span>Exit code</span>
            <b>
              <em>1</em> vs <em>0</em>
            </b>
          </div>
          <div className="diff-row">
            <span>Worker isolation</span>
            <b className="unknown-text">unknown</b>
          </div>
          <div className="mini-terminal">
            <span aria-hidden="true">›</span>
            <span>compare recorded runs</span>
            <b>3 findings</b>
          </div>
        </div>
      </div>
    );
  }

  if (index === 2) {
    return (
      <div className="step-visual">
        <div className="step-visual-head">
          <span className="step-visual-dot" aria-hidden="true" />
          <span className="mono-label">Evidence review</span>
          <span className="step-visual-tag">needs review</span>
        </div>
        <div className="step-visual-body">
          <div className="evidence-mini">
            <div className="evidence-mini-top">
              <span className="claim observed">Observed</span>
              <span className="mono-label">ev_1042</span>
            </div>
            <p>Execution order differs between the recorded runs.</p>
          </div>
          <div className="evidence-mini">
            <div className="evidence-mini-top">
              <span className="claim hypothesis">Hypothesis</span>
              <span className="mono-label">medium confidence</span>
            </div>
            <p>Auth state may persist into the ordered suite.</p>
          </div>
          <div className="evidence-mini">
            <div className="evidence-mini-top">
              <span className="claim unknown">Unknown</span>
              <span className="mono-label">open question</span>
            </div>
            <p>Whether worker isolation would remove the effect.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="step-visual">
      <div className="step-visual-head">
        <span className="step-visual-dot" aria-hidden="true" />
        <span className="mono-label">Fix review</span>
        <span className="step-visual-tag">approval-gated</span>
      </div>
      <div className="step-visual-body">
        <div className="diff-block">
          <div className="diff-del">- expect(session).toBe(null)</div>
          <div className="diff-add">+ afterEach(() =&gt; resetSession())</div>
        </div>
        <div className="verify-result">
          <span className="status-dot success" aria-hidden="true" />
          Verification recorded · exit 0
        </div>
        <div className="mini-terminal">
          <span aria-hidden="true">›</span>
          <span>node --test test/*.test.js</span>
          <b>verified</b>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [menu, setMenu] = useState(false);
  const [tab, setTab] = useState<"evidence" | "comparison">("evidence");
  const [snapshot, setSnapshot] = useState<InvestigationSnapshot | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/investigations")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load investigation.");
        return (await response.json()) as InvestigationSnapshot;
      })
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load investigation.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function runDemo() {
    setRunning(true);
    setError(null);

    try {
      const response = await fetch("/api/investigations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run-workflow" })
      });
      const data = (await response.json()) as InvestigationSnapshot & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "The runner could not finish.");
      setSnapshot(data);
      setTab("evidence");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The runner could not finish.");
    } finally {
      setRunning(false);
    }
  }

  async function patchAction(action: "propose-patch" | "approve-patch" | "revert-patch") {
    setRunning(true); setError(null);
    try {
      const patchId = snapshot?.patches.at(-1)?.id;
      const response = await fetch("/api/investigations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...(patchId ? { patchId } : {}) }) });
      const data = (await response.json()) as InvestigationSnapshot & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Patch operation failed.");
      setSnapshot(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Patch operation failed."); }
    finally { setRunning(false); }
  }


  return (
    <div className="site">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className="nav">
        <nav aria-label="Primary" className="frame nav-inner">
          <a className="brand" href="#top">
            <Mark />
            Breakpoint
          </a>

          <div className="nav-center">
            <div className="nav-links nav-links-left">
              {navLinksLeft.map((link) => (
                <a key={link.href} className="nav-link link-underline" href={link.href}>
                  {link.label}
                </a>
              ))}
            </div>

            <a className="nav-mark" href="#top" aria-label="Breakpoint home">
              <Mark />
            </a>

            <div className="nav-links nav-links-right">
              {navLinksRight.map((link) => (
                <a key={link.href} className="nav-link link-underline" href={link.href}>
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          <div className="nav-right">
            <a className="nav-cta" href="/app">
              <span className="cta-inner">
                <svg className="cta-icon" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <rect x="2.9" y="1.7" width="8.2" height="10.6" rx="1.7" stroke="currentColor" strokeWidth="1.25" />
                  <path d="M5.5 5.5h3M5.5 8.3h2.2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
                </svg>
                <span>Open dashboard</span>
                <svg className="cta-arrow" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path
                    d="M2.6 6h6.1M6.3 3.6L8.7 6l-2.4 2.4"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </a>

            <button
              type="button"
              className="menu"
              aria-label={menu ? "Close menu" : "Open menu"}
              aria-expanded={menu}
              aria-controls="mobile-menu"
              onClick={() => setMenu((value) => !value)}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                {menu ? (
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                ) : (
                  <path d="M3 6h14M3 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </nav>

        {menu && (
          <div id="mobile-menu" className="mobile-menu">
            <div className="mobile-links">
              {mobileLinks.map((link) => (
                <a
                  key={link.href}
                  className="nav-link link-underline"
                  href={link.href}
                  onClick={() => setMenu(false)}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </header>

      <main id="main">
        <section className="hero" id="top">
          <HeroVisual />
          <div className="frame">
            <div className="hero-grid">
              <Reveal delay={100}>
                <span className="kicker">Evidence-first debugging · powered by Codex</span>
                <h1 className="hero-title">
                  Don&apos;t guess the bug.
                  <br />
                  <span className="serif">Prove</span> it.
                </h1>
              </Reveal>

              <div className="hero-side">
                <Reveal delay={200}>
                  <p>
                    Breakpoint gives inconsistent test failures a structured investigation: reproduce the
                    condition, compare the evidence, test the hypothesis, and verify the result.
                  </p>
                </Reveal>

                <Reveal delay={300} className="hero-actions">
                  <a className="btn btn-secondary" href="#workflow">
                    Explore the workflow <span aria-hidden="true">↓</span>
                  </a>
                  <a className="btn btn-primary" href="#demo">
                    See the investigation <span aria-hidden="true">→</span>
                  </a>
                </Reveal>

                <Reveal delay={360} className="hero-note">
                  <span>Local runs</span>
                  <span className="sep">·</span>
                  <span>Linked evidence</span>
                  <span className="sep">·</span>
                  <span>Approval-gated fixes</span>
                </Reveal>
              </div>
            </div>
          </div>

          <Reveal id="demo" delay={420} className="demo-block frame">
            <InvestigationWindow
              snapshot={snapshot}
              error={error}
              running={running}
              tab={tab}
              onTabChange={setTab}
              onRun={runDemo}
              onPatchAction={patchAction}
            />
          </Reveal>

          <Reveal delay={460} className="chips-row frame">
            <ul className="chips" aria-label="Stack">
              <li className="chip">Local Node test runner</li>
              <li className="chip">Evidence-linked findings</li>
              <li className="chip">Approval-gated fixes</li>
              <li className="chip">Recorded verification</li>
            </ul>
            <span className="hero-caption">Illustrative product view · live local demo</span>
          </Reveal>
        </section>

        <section id="workflow" aria-label="The debugging workflow" className="marquee-band">
          <div className="marquee-row">
            <div className="marquee-pill">The workflow</div>
            <div className="marquee-mask">
              <div className="marquee-track">
                <StageSet />
                <div aria-hidden="true">
                  <StageSet />
                </div>
              </div>
            </div>
          </div>
          <p className="marquee-caption">
            One investigation, from first failure to documented result.
          </p>
        </section>

        <section id="problem" className="section band">
          <div className="frame">
            <Reveal className="section-head">
              <span className="kicker">01 · The problem</span>
              <h2 className="h2-band">
                Tests can pass alone and fail in <span className="serif">context</span>.
              </h2>
              <p>
                When a failure depends on order, state, or environment, a log dump is not enough. You need a
                record of what actually changed between runs.
              </p>
            </Reveal>

            <div className="trio-grid">
              {problemCards.map((card, index) => (
                <Reveal key={card.kicker} delay={index * 90} className="trio-card">
                  <div className="trio-top">
                    <span className="trio-num">{String(index + 1).padStart(2, "0")}</span>
                    <span className="trio-kicker">{card.kicker}</span>
                  </div>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="section">
          <div className="frame">
            <Reveal className="section-head center">
              <span className="kicker">02 · The workflow</span>
              <h2 className="h2-section">
                From a failing test to a <span className="serif">documented</span> result.
              </h2>
              <p>
                Four disciplined steps. Each one leaves a record behind, so the next decision starts from
                evidence, not memory.
              </p>
            </Reveal>

            <div className="workflow-rows">
              {workflowSteps.map((step, index) => (
                <Reveal
                  key={step.label}
                  delay={index * 60}
                  className={`workflow-row ${index % 2 === 1 ? "reverse" : ""}`}
                >
                  <div className="workflow-copy">
                    <span className="kicker">{step.label}</span>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                    <p className="workflow-inout">{step.inOut}</p>
                  </div>
                  <div className="workflow-visual">
                    <StepVisual index={index} />
                  </div>
                </Reveal>
              ))}
            </div>

            <p className="figure-note">Illustrative run data · the live demo executes the real test commands</p>
          </div>
        </section>

        <section id="evidence" className="section">
          <div className="frame explainer-grid">
            <Reveal className="explainer-copy">
              <span className="kicker">03 · The investigation window</span>
              <h2 className="h2-section">
                One place for the run, the <span className="serif">difference</span>, and the decision.
              </h2>
              <p>
                Breakpoint keeps each debugging claim beside the run data that supports it. The investigation
                stays reviewable from the first reproduction through verification.
              </p>
              <a className="arrow-link" href="#demo">
                Open the live demo <span aria-hidden="true">→</span>
              </a>
            </Reveal>

            <Reveal delay={120} className="evidence-card">
              <div className="evidence-card-head">
                <span className="mono-label">Investigation · INV-0042</span>
                <span className="badge badge-warning">Needs review</span>
              </div>
              <h3>Session state persists between tests</h3>
              <div className="evidence-card-rows">
                <div className="evidence-card-row">
                  <span>Run pair</span>
                  <b>
                    <i className="fail-dot" aria-hidden="true" /> run_0184 <small>vs</small>
                    <i className="pass-dot" aria-hidden="true" /> run_0181
                  </b>
                </div>
                <div className="evidence-card-row">
                  <span>Observed</span>
                  <b>Execution order differs</b>
                </div>
                <div className="evidence-card-row">
                  <span>Hypothesis</span>
                  <b>Auth state is retained</b>
                </div>
                <div className="evidence-card-row">
                  <span>Unknown</span>
                  <b>Worker isolation behavior</b>
                </div>
              </div>
              <div className="card-terminal">
                <span aria-hidden="true">›</span>
                <span>node --test test/*.test.js</span>
                <b>exit 1</b>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="difference" className="section band">
          <div className="frame">
            <Reveal className="section-head center">
              <span className="kicker">04 · The difference</span>
              <h2 className="h2-band">
                A log dump records <span className="serif">noise</span>.
                <br />
                Breakpoint records evidence.
              </h2>
              <p>
                A transcript can tell you something happened. An investigation can tell you what changed, what
                supports the explanation, and what is still unknown.
              </p>
            </Reveal>

            <div className="compare-grid">
              <Reveal delay={100} className="compare-card">
                <h3>
                  A raw log dump <span className="badge badge-muted">After the fact</span>
                </h3>
                <ul className="compare-list">
                  {otherTools.map((item) => (
                    <li key={item}>
                      <span className="mark-x" aria-hidden="true">
                        ✗
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>

              <Reveal delay={200} className="compare-card win">
                <h3>
                  Breakpoint <span className="badge">Evidence-first</span>
                </h3>
                <ul className="compare-list">
                  {breakpoint.map((item) => (
                    <li key={item}>
                      <span className="mark-check" aria-hidden="true">
                        ✓
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </div>
        </section>

        <section id="principles" className="section">
          <div className="frame">
            <Reveal className="section-head">
              <span className="kicker">05 · A better claim</span>
              <h2 className="h2-section">
                Every conclusion should show its <span className="serif">work</span>.
              </h2>
              <p>
                Breakpoint keeps the boundary between fact, explanation and open question visible, so a
                plausible story does not become a false root cause.
              </p>
            </Reveal>

            <div className="claim-grid">
              <Reveal className="claim-card">
                <span className="claim observed">Observed</span>
                <h3>What the run data directly shows</h3>
                <p>
                  Execution order, exit codes, captured output and configuration are facts when the runner
                  records them.
                </p>
              </Reveal>

              <Reveal delay={90} className="claim-card">
                <span className="claim hypothesis">Hypothesis</span>
                <h3>What may explain those facts</h3>
                <p>
                  Potential causes remain explicitly uncertain until a targeted test can support or reject
                  them.
                </p>
              </Reveal>

              <Reveal delay={180} className="claim-card">
                <span className="claim unknown">Unknown</span>
                <h3>What has not been established</h3>
                <p>
                  Breakpoint keeps gaps visible, so the investigation never claims more certainty than the
                  evidence supports.
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="quote-section" aria-label="Breakpoint principle">
          <Reveal className="quote-inner">
            <span className="kicker kicker-muted">The Breakpoint principle</span>
            <p>
              The useful debugging tool isn&apos;t the one that sounds most certain. It&apos;s the one that
              makes the evidence impossible to ignore.
            </p>
          </Reveal>
        </section>

        <section className="cta-section">
          <div className="frame">
            <Reveal className="cta-panel">
              <h2>
                Make the next failure <span className="serif">legible</span>.
              </h2>
              <p>
                Start with a controlled run. Compare what actually changed. Keep every conclusion tied to
                evidence you can inspect.
              </p>

              <div className="cta-actions">
                <a className="btn btn-primary" href="#demo">
                  Run the investigation <span aria-hidden="true">→</span>
                </a>
                <a className="btn btn-secondary" href="#workflow">
                  Explore the workflow
                </a>
              </div>

              <div className="next-steps">
                <p className="next-steps-label">The simplest next step</p>
                <ol>
                  {nextSteps.map((step, index) => (
                    <li key={step.label}>
                      <a className="next-step" href={step.href}>
                        <span className="n">{String(index + 1).padStart(2, "0")}</span>
                        <span className="t">{step.label}</span>
                      </a>
                      {index < nextSteps.length - 1 && (
                        <span className="next-arrow" aria-hidden="true">
                          →
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
