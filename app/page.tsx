"use client";
import { useState } from "react";
import type { Lead, SearchResult } from "@/lib/types";

const EXAMPLES = [
  "restaurants", "dentists", "law firms", "auto repair", "salons",
  "gyms", "real estate", "hvac contractors", "software companies",
];

export default function Home() {
  const [niche, setNiche] = useState("restaurants");
  const [location, setLocation] = useState("Warren, MI");
  const [limit, setLimit] = useState(40);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, location, limit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    if (!result) return;
    const cols = [
      "name", "category", "tier", "score", "phone", "email", "website",
      "address", "city", "needSignals", "pitch", "mapUrl",
    ];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = result.leads.map((l: Lead) =>
      cols.map((c) => esc(c === "needSignals" ? l.needSignals.join("; ") : (l as any)[c])).join(",")
    );
    const csv = [cols.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `leads_${niche}_${location}`.replace(/[^a-z0-9]+/gi, "_") + ".csv";
    a.click();
  }

  const hot = result?.leads.filter((l) => l.tier === "HOT").length ?? 0;
  const warm = result?.leads.filter((l) => l.tier === "WARM").length ?? 0;

  return (
    <div className="wrap">
      <div className="brand">
        <div className="logo">LR</div>
        <h1>LeadRadar</h1>
      </div>
      <p className="tag">Type any niche + location → real, qualified leads that actually need your work.</p>

      <form className="card form" onSubmit={run}>
        <div>
          <label>Business niche</label>
          <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g. restaurant pos, dentists, software dev" />
        </div>
        <div>
          <label>Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Warren, MI" />
        </div>
        <div>
          <label>Max leads</label>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={20}>20</option>
            <option value={40}>40</option>
            <option value={60}>60</option>
            <option value={80}>80</option>
          </select>
        </div>
        <button className="go" disabled={loading}>{loading ? "Scanning…" : "Find Leads"}</button>
      </form>

      <div className="chips">
        {EXAMPLES.map((ex) => (
          <span key={ex} className="chip" onClick={() => setNiche(ex)}>{ex}</span>
        ))}
      </div>

      {loading && (
        <div className="status"><span className="spinner" /> Geocoding, pulling real businesses & auditing their web presence…</div>
      )}
      {error && <div className="status error">⚠ {error}</div>}

      {result && (
        <>
          <div className="summary">
            <div className="stat"><b>{result.count}</b><span>leads found</span></div>
            <div className="stat"><b style={{ color: "var(--hot)" }}>{hot}</b><span>🔥 hot</span></div>
            <div className="stat"><b style={{ color: "var(--warm)" }}>{warm}</b><span>warm</span></div>
            <div className="stat"><b style={{ fontSize: 14, fontWeight: 600 }}>{result.matchedTags.join(", ")}</b><span>matched category</span></div>
            <button className="ghost" onClick={exportCsv} style={{ marginLeft: "auto" }}>⬇ Export CSV</button>
          </div>
          {result.notes.map((n, i) => <div key={i} className="status">ℹ {n}</div>)}

          <div className="leads">
            {result.leads.length === 0 && <div className="card empty">No businesses found here. Try a broader location or different niche.</div>}
            {result.leads.map((l) => (
              <div className="lead" key={l.id}>
                <div className={`badge ${l.tier}`}>{l.score}<small>{l.tier}</small></div>
                <div>
                  <h3>{l.name}</h3>
                  <div className="cat">{l.category.replace(/_/g, " ")}{l.city ? ` · ${l.city}` : ""}</div>
                  <div className="meta">
                    {l.phone && <span>📞 <a href={`tel:${l.phone}`}>{l.phone}</a></span>}
                    {l.email && <span>✉ <a href={`mailto:${l.email}`}>{l.email}</a></span>}
                    {l.website ? <span>🌐 <a href={l.website} target="_blank" rel="noreferrer">website</a></span> : <span>🌐 no website</span>}
                    <span>📍 <a href={l.mapUrl} target="_blank" rel="noreferrer">map</a></span>
                  </div>
                  <div className="signals">
                    {l.needSignals.map((s, i) => (
                      <span key={i} className={`sig ${/no |not |down|outdated|insecure/i.test(s) ? "bad" : ""}`}>{s}</span>
                    ))}
                  </div>
                  <div className="pitch">💡 {l.pitch}</div>
                </div>
                <div className="scoreR"><b>{l.score}</b>/100</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
