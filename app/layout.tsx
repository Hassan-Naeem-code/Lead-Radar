import type { Metadata } from "next";
import "./globals.css";
import { themeCss } from "@/lib/site-settings";
import { getSiteSettings } from "@/lib/site-settings.server";

// Title/description follow the live brand so a rename in /admin/branding shows in
// the browser tab and share cards too.
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  return {
    title: `${s.brand_name} — ${s.tagline}`,
    description:
      "Tell us your ideal customer. We surface real local businesses, verify every email and phone, confirm they're open, and deliver only leads worth paying for.",
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <html lang="en">
      <head>
        {/* DB-driven palette overrides globals.css (html:root outspecifies :root). */}
        <style id="theme-overrides" dangerouslySetInnerHTML={{ __html: themeCss(settings) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
