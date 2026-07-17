import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FreshLeadsMark } from "../icons";

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US")}`;

// Placeholder — Phase 4 replaces the button with a Stripe Checkout redirect.
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ quote?: string }>;
}) {
  const { quote: quoteId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/quote");

  const { data: quote } = quoteId
    ? await supabase.from("quotes").select("*").eq("id", quoteId).maybeSingle()
    : { data: null };

  return (
    <div className="wrap">
      <div className="brand">
        <div className="logo"><FreshLeadsMark size={22} /></div>
        <h1>Checkout</h1>
      </div>
      {quote ? (
        <div className="card">
          <div className="qprice">
            <b>{money(quote.amount_cents)}</b>
            <span>{quote.breakdown?.billing === "monthly" ? "/ month" : "one-time"}</span>
          </div>
          <div className="qunit">
            {quote.monthly_lead_volume} verified leads · {money(quote.unit_price_cents)} each
          </div>
          <div className="status" style={{ marginTop: 18 }}>
            Payment is being connected (Stripe). This step goes live in the next update.
          </div>
        </div>
      ) : (
        <div className="card empty">
          No quote selected. <Link href="/onboarding" className="linkish">Start here</Link>.
        </div>
      )}
    </div>
  );
}
