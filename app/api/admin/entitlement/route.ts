import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Admin edits a user's entitlement directly on the orders row (local DB only —
// Stripe is never touched). Because lib/gate.ts reads orders live via the
// service role, any change here is effective on the user's next request.
const Schema = z.object({
  userId: z.string().uuid(),
  orderId: z.string().uuid().nullable().optional(), // null/absent => create a comp order
  lead_quota: z.number().int().min(0).max(1_000_000),
  leads_used: z.number().int().min(0).max(1_000_000),
  status: z.enum(["paid", "pending", "paused", "refunded", "failed"]),
  period_end: z.string().min(1).nullable().optional(), // ISO or YYYY-MM-DD
});

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { userId, orderId, lead_quota, leads_used, status, period_end } = parsed.data;

  // Normalise the expiry to an ISO timestamp (or null = no expiry).
  let periodEndIso: string | null = null;
  if (period_end) {
    const d = new Date(period_end);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid expiry date" }, { status: 400 });
    }
    periodEndIso = d.toISOString();
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  if (orderId) {
    const { error } = await admin
      .from("orders")
      .update({ lead_quota, leads_used, status, period_end: periodEndIso })
      .eq("id", orderId)
      .eq("user_id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, orderId });
  }

  // No order yet — grant a complimentary one (amount 0). This is how an admin
  // "operates access" for a user who never went through checkout.
  const { data, error } = await admin
    .from("orders")
    .insert({
      user_id: userId,
      amount_cents: 0,
      currency: "usd",
      status,
      lead_quota,
      leads_used,
      period_start: nowIso,
      period_end: periodEndIso,
      paid_at: status === "paid" ? nowIso : null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, orderId: data.id });
}
