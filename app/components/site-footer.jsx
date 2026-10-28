"use client";

import { useEffect, useState } from "react";
import HalftoneWordmarkFooter from "./halftone-wordmark-footer";
import { Mark } from "./brand-mark";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Launch Breakpoint", href: "/app" },
      { label: "Workflow", href: "#workflow" },
      { label: "Evidence window", href: "#evidence" }
    ]
  },
  {
    title: "Developers",
    links: [
      { label: "Demo workspace", href: "/dashboard" },
      { label: "Investigation report", href: "/investigations/inv_session_state/summary" },
      { label: "Run plan", href: "/investigations/new" },
      { label: "Principles", href: "#principles" }
    ]
  },
  {
    title: "Contact",
    links: [
      { label: "Open sample project", href: "/app" },
      { label: "Run the live demo", href: "#demo" }
    ]
  }
];

export function SiteFooter() {
  const [theme, setTheme] = useState("warm");
  const year = new Date().getFullYear();

  useEffect(() => {
    const updateTheme = () => {
      const current = document.documentElement.getAttribute("data-theme") || "warm";
      setTheme(current);
    };

    updateTheme();

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "data-theme") {
          updateTheme();
        }
      }
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const isDark = theme === "dark";

  const palette = isDark
    ? { background: "#080a0f", ink: "#f1f5f9", warm: "#0ea5e9" }
    : { background: "#EDE8E1", ink: "#1C1917", warm: "#C2410C" };

  return (
    <HalftoneWordmarkFooter
      wordmark="breakpoint"
      label={
        <>
          <Mark />
          Breakpoint
        </>
      }
      meta={
        <div className="footer-telemetry-meta">
          <span className="footer-status-pill">
            <span className="pulse-dot-green" aria-hidden="true" />
            ENGINE v2.4 ONLINE
          </span>
          <span>The evidence engine for flaky and order-dependent bugs.</span>
        </div>
      }
      columns={columns}
      backToTop
      note={
        <>
          © {year} Breakpoint · Precision Debugging Runtime · Built for DevDay Exchange Metro Hackathon
        </>
      }
      palette={palette}
      fontFamily='"Plus Jakarta Sans", "Outfit", system-ui, sans-serif'
      fontWeight={800}
      monoFamily='"JetBrains Mono", monospace'
      crop={-0.12}
      height="clamp(560px, 44vw, 660px)"
    />
  );
}
