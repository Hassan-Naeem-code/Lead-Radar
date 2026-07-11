import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadRadar — Verified local business leads, on demand",
  description:
    "Tell us your ideal customer. We surface real local businesses, verify every email and phone, confirm they're open, and deliver only leads worth paying for.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
