import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeQuoteOptions, type Quote } from "@/lib/quote";
import { Check } from "../icons";
import { getSiteSettings } from "@/lib/site-settings.server";
import { BrandMark } from "../brand";
import { QuoteChoice } from "./QuoteChoice";

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default async function QuotePage({
  searchParams,
}: {
  searchParams: Promise<{ bp?: string }>;
}) {
  const { bp } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/quote");

  // Load the chosen profile, or the caller's most recent one.
  let query = supabase.from("business_profiles").select("*").eq("user_id", user.id);
  query = bp ? query.eq("id", bp) : query.order("created_at", { ascending: false }).limit(1);
  const { data: profile } = await query.maybeSingle();
  const settings = await getSiteSettings();

  if (!profile) {
    return (
      <div className="wrap">
        <div className="brand"><h1>No profile yet</h1></div>
        <div className="card empty">
          Tell us what you&rsquo;re looking for first.{" "}
          <Link href="/onboarding" className="linkish">Define your ideal lead</Link>.
        </div>
      </div>
    );
  }

  const options = computeQuoteOptions({
    monthlyLeadVolume: profile.monthly_lead_volume,
    minQualityScore: profile.min_quality_score,
    radiusKm: profile.radius_km,
  });

  return (
    <div className="wrap">
      <div className="brand">
        <div className="logo"><BrandMark settings={settings} size={22} /></div>
        <h1>Your custom quote</h1>
      </div>
      <p className="tag">
        For <b>{profile.monthly_lead_volume}</b> verified <b>{profile.niche}</b> leads
        around <b>{profile.location}</b>. Choose how you&rsquo;d like to pay.
      </p>

      <div className="qgrid">
        <QuotePlan
          title="Monthly plan"
          subtitle="Recurring lead quota · cancel anytime"
          quote={options.monthly}
          highlight
          businessProfileId={profile.id}
          cta="Start monthly plan"
        />
        <QuotePlan
          title="One-time pack"
          subtitle="Pay once for a batch of leads"
          quote={options.one_time}
          businessProfileId={profile.id}
          cta="Buy one-time pack"
        />
      </div>

      <p className="note" style={{ textAlign: "center", marginTop: 22 }}>
        Only verified, deliverable leads count against your quota.{" "}
        <Link href="/onboarding" className="linkish">Adjust my needs</Link>
      </p>
    </div>
  );
}

function QuotePlan({
  title, subtitle, quote, highlight, businessProfileId, cta,
}: {
  title: string;
  subtitle: string;
  quote: Quote;
  highlight?: boolean;
  businessProfileId: string;
  cta: string;
}) {
  return (
    <div className={`card qplan ${highlight ? "hot" : ""}`}>
      {highlight && <span className="qbadge">Best value</span>}
      <h3>{title}</h3>
      <p className="qsub">{subtitle}</p>
      <div className="qprice">
        <b>{money(quote.amountCents)}</b>
        <span>{quote.billing === "monthly" ? "/ month" : "one-time"}</span>
      </div>
      <div className="qunit">{money(quote.unitPriceCents)} per verified lead × {quote.volume}</div>

      <ul className="qbreak">
        {quote.breakdown.map((line, i) => (
          <li key={i}>
            <Check size={13} className="i-cool" />
            <span><b>{line.label}</b> — {line.detail}</span>
          </li>
        ))}
      </ul>

      <QuoteChoice businessProfileId={businessProfileId} billing={quote.billing} label={cta} />
    </div>
  );
}
