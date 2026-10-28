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
    const year = new Date().getFullYear();
    return (<HalftoneWordmarkFooter wordmark="breakpoint" label={<>
          <Mark />
          Breakpoint
        </>} meta={<div className="footer-telemetry-meta">
          <span className="footer-status-pill">
            <span className="pulse-dot-green" aria-hidden="true" />
            ENGINE v2.4 ONLINE
          </span>
          <span>The evidence engine for flaky and order-dependent bugs.</span>
        </div>} columns={columns} backToTop note={<>
          © {year} Breakpoint · Precision Debugging Runtime · Built for DevDay Exchange Metro Hackathon
        </>} palette={{
            background: "#080a0f",
            ink: "#f1f5f9",
            warm: "#0ea5e9"
        }} fontFamily='"Outfit", system-ui, sans-serif' fontWeight={800} monoFamily='"Outfit", system-ui, sans-serif' crop={-0.12} height="clamp(560px, 44vw, 660px)"/>);
}
