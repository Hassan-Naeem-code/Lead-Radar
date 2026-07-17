import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, stripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

const Body = z.object({ quoteId: z.string().uuid() });

// Create a Stripe Checkout session from a stored quote (price of record) and a
// pending order. The webhook is what actually grants access once paid.
export async function POST(req: NextRequest) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Payments not configured yet." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  // RLS ensures the quote belongs to this user.
  const { data: quote } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", parsed.data.quoteId)
    .maybeSingle();
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const billing: "monthly" | "one_time" = quote.breakdown?.billing ?? "one_time";
  const stripe = getStripe();
  const admin = createAdminClient();

  // Reuse or create the Stripe customer for this user.
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id, email, full_name")
    .eq("id", user.id)
    .maybeSingle();

  let customerId = profile?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email ?? undefined,
      name: profile?.full_name ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  const isSub = billing === "monthly";

  // Pending order row (service-role — users can't write orders).
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      user_id: user.id,
      quote_id: quote.id,
      amount_cents: quote.amount_cents,
      currency: quote.currency,
      status: "pending",
      lead_quota: quote.monthly_lead_volume,
    })
    .select("id")
    .single();
  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

  const session = await stripe.checkout.sessions.create({
    mode: isSub ? "subscription" : "payment",
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: quote.currency,
          unit_amount: quote.amount_cents,
          product_data: { name: `Fresh Leads — ${quote.monthly_lead_volume} verified leads` },
          ...(isSub ? { recurring: { interval: "month" as const } } : {}),
        },
      },
    ],
    success_url: `${site}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/checkout/cancel`,
    metadata: { user_id: user.id, quote_id: quote.id, order_id: order.id },
  });

  // Link the session to the pending order so the webhook can find it.
  await admin
    .from("orders")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", order.id);

  return NextResponse.json({ url: session.url });
}
