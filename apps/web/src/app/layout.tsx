import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Application Tracker v2", template: "%s | Application Tracker v2" },
  description: "Candidate profiles, resume preparation, and application operations.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
