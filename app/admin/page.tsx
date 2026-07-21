import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteSettings } from "@/lib/site-settings.server";
import { AdminShell } from "./AdminShell";

export default async function AdminOverview() {
  const { email } = await requireAdmin();
  const settings = await getSiteSettings();
  const admin = createAdminClient();

  const [{ count: userCount }, { data: orders }] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("orders").select("status, lead_quota, leads_used, period_end"),
  ]);

  const now = Date.now();
  const all = orders ?? [];
  const activePaid = all.filter(
    (o) =>
      o.status === "paid" &&
      (!o.period_end || new Date(o.period_end).getTime() >= now) &&
      (o.lead_quota ?? 0) - (o.leads_used ?? 0) > 0
  ).length;
  const paidTotal = all.filter((o) => o.status === "paid").length;
  const leadsDelivered = all.reduce((s, o) => s + (o.leads_used ?? 0), 0);

  const stats = [
    { label: "Total users", value: userCount ?? 0 },
    { label: "Active subscriptions", value: activePaid },
    { label: "Paid orders (all time)", value: paidTotal },
    { label: "Leads delivered", value: leadsDelivered },
  ];

  return (
    <AdminShell email={email} settings={settings}>
      <div className="adm-page">
        <h1>Overview</h1>
        <p className="adm-sub">A quick pulse on accounts and access.</p>

        <div className="adm-stats">
          {stats.map((s) => (
            <div className="adm-stat" key={s.label}>
              <b>{s.value.toLocaleString("en-US")}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        <div className="adm-cards">
          <Link href="/admin/users" className="adm-card">
            <b>Users &amp; plans →</b>
            <p>See every account, adjust lead quota, status and expiry, or grant access.</p>
          </Link>
          <Link href="/admin/branding" className="adm-card">
            <b>Branding →</b>
            <p>Change the color theme, logo, and brand name across the whole site.</p>
          </Link>
        </div>
      </div>
    </AdminShell>
  );
}
