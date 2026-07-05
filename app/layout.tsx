import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadRadar — Lead Finder",
  description: "Find real, qualified B2B leads for any niche, anywhere.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
