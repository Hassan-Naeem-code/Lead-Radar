import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { computeQuote, type Billing } from "@/lib/quote";

export const runtime = "nodejs";

const Body = z.object({
  business_profile_id: z.string().uuid(),
  billing: z.enum(["monthly", "one_time"]),
});

// Compute a quote server-side from a stored business profile (never from a client price),
// persist it, and return it. This is the price of record for checkout.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Load the profile (RLS ensures it belongs to this user).
  const { data: profile, error: pErr } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("id", parsed.data.business_profile_id)
    .single();
  if (pErr || !profile) {
    return NextResponse.json({ error: "Business profile not found" }, { status: 404 });
  }

  const quote = computeQuote({
    monthlyLeadVolume: profile.monthly_lead_volume,
    minQualityScore: profile.min_quality_score,
    radiusKm: profile.radius_km,
    billing: parsed.data.billing as Billing,
  });

  const { data: saved, error: qErr } = await supabase
    .from("quotes")
    .insert({
      user_id: user.id,
      business_profile_id: profile.id,
      monthly_lead_volume: quote.volume,
      unit_price_cents: quote.unitPriceCents,
      amount_cents: quote.amountCents,
      currency: quote.currency,
      breakdown: { billing: quote.billing, lines: quote.breakdown, leadQuota: quote.leadQuota },
      status: "draft",
    })
    .select("id")
    .single();

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });
  return NextResponse.json({ quoteId: saved.id, quote });
}
