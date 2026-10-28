import "./styles.css";
import "./runtime.css";
import "./dashboard/dashboard.css";

export const metadata = {
  title: "Breakpoint — The Deterministic Test Runtime & Evidence Engine",
  description: "Eliminate flaky and order-dependent test failures with deterministic execution replay, memory isolation, and root-cause tracing."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark" data-theme="dark" suppressHydrationWarning>
      <body className="antialiased bg-obsidian text-ink" suppressHydrationWarning>
        <div className="ambient-background-glow" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
