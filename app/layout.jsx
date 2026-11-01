import "./styles.css";
import "./runtime.css";
import "./dashboard/dashboard.css";

export const viewport = {
  themeColor: "#060913",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export const metadata = {
  title: "Breakpoint — The Deterministic Test Runtime & Evidence Engine",
  description: "Eliminate flaky and order-dependent test failures with deterministic execution replay, memory isolation, and root-cause tracing.",
  metadataBase: new URL("https://breakpoint.run"),
  openGraph: {
    title: "Breakpoint — The Deterministic Test Runtime & Evidence Engine",
    description: "Eliminate flaky and order-dependent test failures with deterministic execution replay, memory isolation, and root-cause tracing.",
    siteName: "Breakpoint",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Breakpoint — The Deterministic Test Runtime & Evidence Engine",
    description: "Eliminate flaky and order-dependent test failures with deterministic execution replay, memory isolation, and root-cause tracing.",
  },
  icons: {
    icon: "/brand/breakpoint-mark-dark.svg",
    apple: "/brand/breakpoint-mark-dark.png",
  },
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
