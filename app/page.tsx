import Link from "next/link";
import {
  FreshLeadsMark, Mail, Phone, Building, Clock, Search, ArrowRight,
  Flame, Gauge, MapPin,
} from "./icons";

export const metadata = {
  title: "Fresh Leads — Verified local business leads, on demand",
  description:
    "Tell us your ideal customer. We surface real local businesses, verify every email and phone, confirm they're open, and deliver only leads worth paying for.",
};

export default function Landing() {
  return (
    <div className="lp">
      {/* Nav */}
      <nav className="lp-nav">
        <div className="lp-brand">
          <span className="logo"><FreshLeadsMark size={20} /></span>
          <b>Fresh Leads</b>
        </div>
        <div className="lp-navlinks">
          <a href="#how">How it works</a>
          <a href="#quality">Quality</a>
          <a href="#pricing">Pricing</a>
          <Link href="/login" className="lp-signin">Sign in</Link>
          <Link href="/signup" className="lp-cta sm">Get started</Link>
        </div>
      </nav>

      {/* Hero */}
      <header className="lp-hero">
        <span className="lp-eyebrow"><Gauge size={13} /> Verified leads, not scraped lists</span>
        <h1>
          Real local leads that<br />
          <span className="grad">actually convert.</span>
        </h1>
        <p className="lp-sub">
          Tell us the business you want to reach. Fresh Leads finds real local companies,
          verifies every email and phone, confirms they&rsquo;re still open, and hands you
          only the leads worth paying for — so you never waste a pitch on a dead address.
        </p>
        <div className="lp-herobtns">
          <Link href="/signup" className="lp-cta"><Search size={16} /> Define your ideal lead</Link>
          <a href="#how" className="lp-ghost">See how it works <ArrowRight size={15} /></a>
        </div>
        <div className="lp-trust">
          <span><Building size={13} /> Real businesses</span>
          <span><Mail size={13} /> Verified email</span>
          <span><Phone size={13} /> Verified phone</span>
          <span><Clock size={13} /> Confirmed active</span>
        </div>
      </header>

      {/* Quality — the four genuine signals */}
      <section id="quality" className="lp-section">
        <h2>Every lead clears four checks before you see it</h2>
        <p className="lp-lead">
          A lead you can&rsquo;t reach isn&rsquo;t a lead. We don&rsquo;t deliver a name until it passes:
        </p>
        <div className="lp-grid4">
          {[
            { icon: <Mail size={20} />, t: "Deliverable email", d: "We find the real inbox from their site and verify it accepts mail — no bounces." },
            { icon: <Phone size={20} />, t: "Reachable phone", d: "Numbers are validated and typed, so you dial a line that actually rings." },
            { icon: <Building size={20} />, t: "Active business", d: "We confirm the site is live and the business is still operating — not closed or stale." },
            { icon: <Clock size={20} />, t: "Fresh data", d: "Listings are age-checked so you know the contact details are still current." },
          ].map((c) => (
            <div className="lp-card" key={c.t}>
              <span className="lp-cardicon">{c.icon}</span>
              <b>{c.t}</b>
              <p>{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="lp-section">
        <h2>From your ideal customer to genuine leads in three steps</h2>
        <div className="lp-steps">
          <div className="lp-step">
            <span className="lp-stepn">1</span>
            <b>Define your business &amp; needs</b>
            <p>Tell us your niche, the area you serve, how many leads you want, and your quality bar.</p>
          </div>
          <div className="lp-step">
            <span className="lp-stepn">2</span>
            <b>Get a custom quote</b>
            <p>We price to your exact needs — volume, area, and how strict your verification is. No fixed tiers.</p>
          </div>
          <div className="lp-step">
            <span className="lp-stepn">3</span>
            <b>Search &amp; export verified leads</b>
            <p>Run searches in a filterable dashboard, grade every prospect, and export only the genuine ones.</p>
          </div>
        </div>
      </section>

      {/* Preview strip */}
      <section className="lp-section">
        <div className="lp-preview">
          <div className="lp-previewbadge HOT">92<small>HOT</small></div>
          <div>
            <h3>Sample: a graded, verified lead</h3>
            <div className="lp-metarow">
              <span><Phone size={13} /> verified</span>
              <span><Mail size={13} /> deliverable</span>
              <span><MapPin size={13} /> active</span>
              <span><Flame size={13} className="i-hot" /> no website — high need</span>
            </div>
            <p className="lp-previewpitch">
              Every lead comes with a 0–100 opportunity grade and a plain-English reason it&rsquo;s worth your time.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="lp-section lp-pricing">
        <h2>Pay for exactly what you need</h2>
        <p className="lp-lead">
          No bloated subscriptions. You describe your ideal lead and volume, and we build a
          quote around it. Only verified, deliverable leads count against it.
        </p>
        <Link href="/signup" className="lp-cta"><ArrowRight size={16} /> Get your custom quote</Link>
      </section>

      <footer className="lp-footer">
        <div className="lp-brand">
          <span className="logo sm"><FreshLeadsMark size={15} /></span>
          <b>Fresh Leads</b>
        </div>
        <span>Verified local business leads, on demand.</span>
      </footer>
    </div>
  );
}
