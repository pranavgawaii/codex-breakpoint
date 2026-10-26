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
        </>} meta="Evidence-first debugging, powered by Codex." columns={columns} backToTop note={<>
          © {year} Breakpoint · Built for the DevDay Exchange Community Metro Hackathon · Pune 2026
        </>} palette={{
            background: "#E8E8E2",
            ink: "#0A0A0F",
            warm: "#4F46E5"
        }} fontFamily='"Outfit", system-ui, sans-serif' fontWeight={800} monoFamily='"Outfit", system-ui, sans-serif' height="clamp(480px, 34vw, 520px)"/>);
}
