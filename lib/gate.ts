import { createAdminClient } from "./supabase/admin";

// A user's current right to pull leads: a paid order, still in its period, with
// quota left. Read with the service-role client so gating never depends on RLS.
export type Entitlement = {
  orderId: string;
  leadQuota: number;
  leadsUsed: number;
  remaining: number;
};

export async function getActiveEntitlement(userId: string): Promise<Entitlement | null> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: orders } = await admin
    .from("orders")
    .select("id, lead_quota, leads_used, period_start, period_end")
    .eq("user_id", userId)
    .eq("status", "paid")
    .order("created_at", { ascending: false });

  for (const o of orders ?? []) {
    const startsOk = !o.period_start || o.period_start <= nowIso;
    const endsOk = !o.period_end || o.period_end >= nowIso;
    const remaining = (o.lead_quota ?? 0) - (o.leads_used ?? 0);
    if (startsOk && endsOk && remaining > 0) {
      return { orderId: o.id, leadQuota: o.lead_quota, leadsUsed: o.leads_used, remaining };
    }
  }
  return null;
}

// Debit a batch of delivered leads against an order (service-role only — users
// have no write access to orders).
export async function debitLeads(orderId: string, count: number): Promise<void> {
  if (count <= 0) return;
  const admin = createAdminClient();
  const { data } = await admin.from("orders").select("leads_used").eq("id", orderId).single();
  const used = (data?.leads_used ?? 0) + count;
  await admin.from("orders").update({ leads_used: used }).eq("id", orderId);
}
