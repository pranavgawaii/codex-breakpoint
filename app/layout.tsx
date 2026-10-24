import type { Metadata } from "next";
import "./styles.css";
import "./runtime.css";

export const metadata: Metadata = {
  title: "Breakpoint — Evidence-first debugging",
  description: "A structured workspace for investigating inconsistent test failures."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <noscript>
          <style>{`.reveal,.reveal.is-visible{opacity:1 !important;transform:none !important;animation:none !important}`}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
