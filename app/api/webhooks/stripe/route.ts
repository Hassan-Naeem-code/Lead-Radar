import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Stripe webhook — the SOURCE OF TRUTH for granting access. The success_url is
// UX only; access is granted here, after signature verification, idempotently.
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  const raw = await req.text(); // raw body required for signature verification
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "bad signature";
    return NextResponse.json({ error: `Signature verification failed: ${msg}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const admin = createAdminClient();

    // Find the pending order (idempotent — skip if already paid).
    const { data: order } = await admin
      .from("orders")
      .select("id, status, lead_quota")
      .eq("stripe_checkout_session_id", session.id)
      .maybeSingle();

    if (order && order.status !== "paid") {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1); // 1-month quota window

      await admin
        .from("orders")
        .update({
          status: "paid",
          paid_at: now.toISOString(),
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
          stripe_payment_intent_id:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
          stripe_subscription_id:
            typeof session.subscription === "string" ? session.subscription : null,
        })
        .eq("id", order.id);

      // Mark the quote accepted.
      if (session.metadata?.quote_id) {
        await admin.from("quotes").update({ status: "accepted" }).eq("id", session.metadata.quote_id);
      }
    }
  }

  return NextResponse.json({ received: true });
}
