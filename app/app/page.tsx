import Link from "next/link";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CheckIcon,
  FolderIcon,
  InfoIcon,
  LockIcon,
  ShieldCheckIcon
} from "../components/icons";
import { BrandMark, ProductHeader, StatusPill } from "../components/product-chrome";

const demoTimeline = [
  {
    index: "01",
    title: "Choose a project",
    body: "Start with the trusted, local sample. Nothing leaves this machine.",
    state: "You are here"
  },
  {
    index: "02",
    title: "Run controlled workflow",
    body: "Execute the ordered, reversed and isolated test pairs.",
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
    body: "Approve a review-only patch and record the rerun result.",
    state: "Then"
  }
];

export default function Onboarding() {
  return (
    <div className="product-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <ProductHeader
        active="projects"
        status={{ label: "Demo ready", tone: "warning" }}
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
                Start with a trusted local demo. Breakpoint will reproduce the failure, keep every
                finding tied to a recorded run, and leave the fix review-only until you approve it.
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
              <strong>Start with the trusted local demo.</strong>
              <p>
                It contains an intentionally reproducible test-order bug: session state survives
                from authentication into the next test.
              </p>
            </div>
            <span className="context-note-meta">No setup required</span>
          </aside>

          <section className="project-section" aria-labelledby="project-heading">
            <div className="section-rule">
              <h2 id="project-heading">Select a workspace</h2>
              <span>01 project available</span>
            </div>

            <div className="project-grid">
              <article className="project-card project-card--primary">
                <div className="project-card-top">
                  <span className="project-icon" aria-hidden="true">
                    <FolderIcon />
                  </span>
                  <StatusPill label="Recommended" tone="neutral" className="project-badge" />
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
                    <CheckIcon /> Review-only fixes
                  </li>
                </ul>

                <div className="project-card-foot">
                  <Link className="btn btn-primary project-cta" href="/dashboard">
                    Open sample project
                    <ArrowRightIcon />
                  </Link>
                  <span className="project-foot-note">
                    <ShieldCheckIcon />
                    No repository access
                  </span>
                </div>
              </article>

              <article className="project-card project-card--muted">
                <div className="project-card-top">
                  <span className="project-icon project-icon--muted" aria-hidden="true">
                    <LockIcon />
                  </span>
                  <StatusPill label="Not available" tone="neutral" className="project-badge" />
                </div>

                <h3>Connect a local project</h3>
                <p className="project-description">
                  Breakpoint intentionally does not accept arbitrary paths or commands from the
                  browser. Project connection stays outside this prototype.
                </p>

                <ul className="project-safety" aria-label="Unavailable capabilities">
                  <li>
                    <LockIcon /> No arbitrary file paths
                  </li>
                  <li>
                    <LockIcon /> No browser-supplied commands
                  </li>
                  <li>
                    <LockIcon /> No repository or secret access
                  </li>
                </ul>

                <div className="project-card-foot">
                  <button className="btn btn-secondary project-cta" type="button" disabled>
                    Connect project
                    <LockIcon />
                  </button>
                  <span className="project-foot-note">Use the sample for this demo</span>
                </div>
              </article>
            </div>
          </section>

          <section className="journey-section" aria-labelledby="journey-heading">
            <div className="journey-head">
              <div>
                <span className="page-kicker">The demo path</span>
                <h2 id="journey-heading">One recorded trail, from failure to fix.</h2>
              </div>
              <p>
                Each step produces an artifact you can inspect. No diagnosis is promoted to fact
                without run evidence behind it.
              </p>
            </div>

            <ol className="journey-steps">
              {demoTimeline.map((step, index) => (
                <li
                  className={`journey-step ${index === 0 ? "is-current" : ""}`.trim()}
                  key={step.index}
                >
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
              Trusted local demo <span aria-hidden="true">·</span> no secrets{" "}
              <span aria-hidden="true">·</span> review before apply
            </p>
            <Link className="product-foot-link" href="/#workflow">
              How Breakpoint works
              <ArrowUpRightIcon />
            </Link>
          </footer>

          <div className="product-signoff" aria-hidden="true">
            <BrandMark />
            <span>Breakpoint</span>
            <span>Evidence-first debugging</span>
          </div>
        </div>
      </main>
    </div>
  );
}
