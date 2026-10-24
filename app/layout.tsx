import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Breakpoint — Evidence-first debugging",
  description: "A structured workspace for investigating inconsistent test failures."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
