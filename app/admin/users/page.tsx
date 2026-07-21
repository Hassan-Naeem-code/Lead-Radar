import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteSettings } from "@/lib/site-settings.server";
import { AdminShell } from "../AdminShell";
import { UsersTable, type AdminUserRow } from "./UsersTable";

export default async function AdminUsersPage() {
  const { email } = await requireAdmin();
  const settings = await getSiteSettings();
  const admin = createAdminClient();

  const [{ data: profiles }, { data: orders }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, full_name, company_name, created_at")
      .order("created_at", { ascending: false }),
    admin
      .from("orders")
      .select("id, user_id, status, lead_quota, leads_used, period_end, stripe_subscription_id, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const now = Date.now();
  const isActive = (o: NonNullable<typeof orders>[number]) =>
    o.status === "paid" &&
    (!o.period_end || new Date(o.period_end).getTime() >= now) &&
    (o.lead_quota ?? 0) - (o.leads_used ?? 0) > 0;

  // For each user pick the "best" order to surface: an active paid one, else the
  // most recent order (orders are already sorted newest-first).
  const ordersByUser = new Map<string, NonNullable<typeof orders>>();
  for (const o of orders ?? []) {
    const list = ordersByUser.get(o.user_id) ?? [];
    list.push(o);
    ordersByUser.set(o.user_id, list);
  }

  const rows: AdminUserRow[] = (profiles ?? []).map((p) => {
    const list = ordersByUser.get(p.id) ?? [];
    const chosen = list.find(isActive) ?? list[0] ?? null;
    return {
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      company_name: p.company_name,
      created_at: p.created_at,
      order: chosen
        ? {
            id: chosen.id,
            status: chosen.status,
            lead_quota: chosen.lead_quota ?? 0,
            leads_used: chosen.leads_used ?? 0,
            period_end: chosen.period_end,
            stripe_subscription_id: chosen.stripe_subscription_id,
            active: isActive(chosen),
          }
        : null,
      order_count: list.length,
    };
  });

  return (
    <AdminShell email={email} settings={settings}>
      <div className="adm-page">
        <h1>Users &amp; plans</h1>
        <p className="adm-sub">
          {rows.length} account{rows.length === 1 ? "" : "s"}. Edit a user&rsquo;s access below —
          changes take effect on their next request. This adjusts access in your database only and
          does not change any real Stripe billing.
        </p>
        <UsersTable rows={rows} />
      </div>
    </AdminShell>
  );
}
