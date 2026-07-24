import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VaidyaAI — Autonomous AI Workforce for Solo Clinics",
  description: "7-agent autonomous AI workforce for solo medical practitioners in India",
  manifest: "/manifest.json",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1"
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-900 text-slate-100 min-h-screen antialiased selection:bg-teal-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
