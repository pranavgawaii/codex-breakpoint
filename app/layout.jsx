import "./styles.css";
import "./runtime.css";
import "./dashboard/dashboard.css";
export const metadata = {
    title: "Breakpoint — The Evidence Engine for Flaky Bugs",
    description: "An evidence-first diagnostic workspace for reproducing, isolating, and verifying inconsistent test failures."
};
export default function RootLayout({ children }) {
    return (<html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased bg-obsidian text-ink" suppressHydrationWarning>
        <noscript>
          <style>{`.reveal,.reveal.is-visible{opacity:1 !important;transform:none !important;animation:none !important}`}</style>
        </noscript>
        <div className="telemetry-grid-bg" aria-hidden="true" />
        {children}
      </body>
    </html>);
}
