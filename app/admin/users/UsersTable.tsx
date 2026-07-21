"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

export type AdminUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  company_name: string | null;
  created_at: string;
  order: {
    id: string;
    status: string;
    lead_quota: number;
    leads_used: number;
    period_end: string | null;
    stripe_subscription_id: string | null;
    active: boolean;
  } | null;
  order_count: number;
};

const STATUSES = ["paid", "pending", "paused", "refunded", "failed"] as const;

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function UsersTable({ rows }: { rows: AdminUserRow[] }) {
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.email, r.full_name, r.company_name].some((v) => v?.toLowerCase().includes(needle))
    );
  }, [rows, q]);

  return (
    <div>
      <div className="adm-search">
        <input
          placeholder="Search by email, name, or company…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="adm-table">
        <div className="adm-tr adm-th">
          <span>User</span>
          <span>Access</span>
          <span>Quota</span>
          <span>Expires</span>
          <span />
        </div>

        {filtered.length === 0 && <div className="adm-empty">No matching users.</div>}

        {filtered.map((r) => (
          <UserRow
            key={r.id}
            row={r}
            open={openId === r.id}
            onToggle={() => setOpenId(openId === r.id ? null : r.id)}
          />
        ))}
      </div>
    </div>
  );
}

function UserRow({
  row,
  open,
  onToggle,
}: {
  row: AdminUserRow;
  open: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const o = row.order;
  const remaining = o ? o.lead_quota - o.leads_used : 0;

  const [quota, setQuota] = useState(o?.lead_quota ?? 100);
  const [used, setUsed] = useState(o?.leads_used ?? 0);
  const [status, setStatus] = useState<string>(o?.status ?? "paid");
  const [expiry, setExpiry] = useState(toDateInput(o?.period_end ?? null));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/entitlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: row.id,
          orderId: o?.id ?? null,
          lead_quota: Number(quota),
          leads_used: Number(used),
          status,
          period_end: expiry ? expiry : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMsg({ kind: "ok", text: o ? "Saved." : "Access granted." });
      router.refresh();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`adm-rowwrap ${open ? "open" : ""}`}>
      <button className="adm-tr adm-row" onClick={onToggle} type="button">
        <span className="adm-user">
          <b>{row.email ?? "—"}</b>
          <small>{row.full_name || row.company_name || "No name"}</small>
        </span>
        <span>
          {o ? (
            <span className={`adm-pill ${o.active ? "on" : "off"}`}>
              {o.active ? "active" : o.status}
            </span>
          ) : (
            <span className="adm-pill none">no access</span>
          )}
        </span>
        <span className="adm-num">{o ? `${remaining} / ${o.lead_quota}` : "—"}</span>
        <span className="adm-num">{o?.period_end ? toDateInput(o.period_end) : "—"}</span>
        <span className="adm-caret">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="adm-editor">
          <div className="adm-fields">
            <label>
              Lead quota
              <input
                type="number"
                min={0}
                value={quota}
                onChange={(e) => setQuota(Number(e.target.value))}
              />
            </label>
            <label>
              Leads used
              <input
                type="number"
                min={0}
                value={used}
                onChange={(e) => setUsed(Number(e.target.value))}
              />
            </label>
            <label>
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Expires
              <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </label>
          </div>

          <div className="adm-editrow">
            <div className="adm-meta">
              {o?.stripe_subscription_id ? (
                <span>Stripe sub: <code>{o.stripe_subscription_id}</code></span>
              ) : (
                <span>{o ? "One-time / comp order" : "No order yet — saving grants a comp order."}</span>
              )}
              {row.order_count > 1 && <span> · {row.order_count} orders total</span>}
            </div>
            <div className="adm-actions">
              {msg && <span className={`adm-msg ${msg.kind}`}>{msg.text}</span>}
              <button className="go" type="button" onClick={save} disabled={saving}>
                {saving ? "Saving…" : o ? "Save changes" : "Grant access"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
