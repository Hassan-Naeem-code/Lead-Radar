"use client";
import { useMemo, useState } from "react";
import type { Lead, SearchResult } from "@/lib/types";
import { GRADE_SCALE, FACTOR_CATALOG, MAX_ATTAINABLE, bandFor } from "@/lib/score";
import {
  FRESHNESS_SCALE,
  bandFor as freshnessBandFor,
  relativeAge,
  ageInDays,
  type FreshnessLevel,
} from "@/lib/freshness";
import {
  FreshLeadsMark, Phone, Mail, Globe, GlobeOff, MapPin, Lightbulb, Download, Info,
  AlertTriangle, Clock, Flame, Gauge, Building, Search, ChevronDown,
  ChevronRight, ArrowRight, RotateCcw, Dot, Check,
} from "../icons";

const EXAMPLES = [
  "restaurants", "dentists", "law firms", "auto repair", "salons",
  "gyms", "real estate", "hvac contractors", "software companies",
];

type SortKey = "score" | "freshest" | "name";

const ALL_TIERS: Lead["tier"][] = ["HOT", "WARM", "COOL"];
const ALL_FRESHNESS: FreshnessLevel[] = ["FRESH", "RECENT", "AGING", "STALE", "UNKNOWN"];

export default function Home() {
  const [niche, setNiche] = useState("restaurants");
  const [location, setLocation] = useState("Warren, MI");
  const [limit, setLimit] = useState(40);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [showScale, setShowScale] = useState(false);

  // --- filters ---
  const [minScore, setMinScore] = useState(0);
  const [tiers, setTiers] = useState<Set<string>>(new Set(ALL_TIERS));
  const [freshLevels, setFreshLevels] = useState<Set<string>>(new Set(ALL_FRESHNESS));
  const [reqFactors, setReqFactors] = useState<Set<string>>(new Set());
  const [genuineOnly, setGenuineOnly] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("score");

  function toggle(set: Set<string>, apply: (s: Set<string>) => void, key: string) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    apply(next);
  }

  function resetFilters() {
    setMinScore(0);
    setTiers(new Set(ALL_TIERS));
    setFreshLevels(new Set(ALL_FRESHNESS));
    setReqFactors(new Set());
    setGenuineOnly(false);
    setQ("");
    setSort("score");
  }

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
      resetFilters();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Filters run client-side over the fetched result set, so they're instant.
  const visible = useMemo(() => {
    if (!result) return [];
    const needle = q.trim().toLowerCase();
    const out = result.leads.filter((l) => {
      if (l.score < minScore) return false;
      if (genuineOnly && !l.deliverable) return false;
      if (!tiers.has(l.tier)) return false;
      if (!freshLevels.has(l.freshness)) return false;
      for (const key of reqFactors) {
        if (!l.scoreFactors.some((f) => f.key === key)) return false;
      }
      if (needle && !`${l.name} ${l.category} ${l.city}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    out.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "freshest") {
        const av = a.freshnessAgeDays ?? Number.MAX_SAFE_INTEGER;
        const bv = b.freshnessAgeDays ?? Number.MAX_SAFE_INTEGER;
        return av - bv || b.score - a.score;
      }
      return b.score - a.score;
    });
    return out;
  }, [result, minScore, tiers, freshLevels, reqFactors, genuineOnly, q, sort]);

  function exportCsv() {
    if (!result) return;
    const cols = [
      "name", "category", "tier", "score", "deliverable", "phoneVerified",
      "emailStatus", "activeStatus", "phone", "email", "website",
      "address", "city", "needSignals", "scoreBreakdown", "freshness",
      "listingUpdated", "pitch", "mapUrl",
    ];
    const val = (l: Lead, c: string) => {
      if (c === "deliverable") return l.deliverable ? "yes" : "no";
      if (c === "phoneVerified") return l.phoneValid ? "yes" : "no";
      if (c === "needSignals") return l.needSignals.join("; ");
      if (c === "scoreBreakdown") return l.scoreFactors.map((f) => `${f.label} +${f.points}`).join("; ");
      if (c === "freshness") return `${l.freshness} (${l.freshnessLabel})`;
      if (c === "listingUpdated") return l.lastUpdated ?? "";
      return (l as unknown as Record<string, unknown>)[c];
    };
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    // Export exactly what's on screen — filters included.
    const rows = visible.map((l) => cols.map((c) => esc(val(l, c))).join(","));
    const csv = [cols.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `leads_${niche}_${location}`.replace(/[^a-z0-9]+/gi, "_") + ".csv";
    a.click();
  }

  const hot = visible.filter((l) => l.tier === "HOT").length;
  const warm = visible.filter((l) => l.tier === "WARM").length;
  const freshCount = visible.filter((l) => l.freshness === "FRESH" || l.freshness === "RECENT").length;
  const genuineCount = visible.filter((l) => l.deliverable).length;
  const filtersOn =
    minScore > 0 || tiers.size < 3 || freshLevels.size < ALL_FRESHNESS.length ||
    reqFactors.size > 0 || genuineOnly || q.trim() !== "";

  const scanAge = result ? relativeAge(ageInDays(result.scannedAt)) : "";

  return (
    <div className="wrap">
      <div className="brand">
        <div className="logo"><FreshLeadsMark size={22} /></div>
        <h1>Fresh Leads</h1>
      </div>
      <p className="tag">Type any niche and location to surface real, qualified leads that need your work.</p>

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

      <GradeScale open={showScale} onToggle={() => setShowScale((v) => !v)} />

      {loading && (
        <div className="status"><span className="spinner" /> Geocoding, pulling real businesses and auditing their web presence…</div>
      )}
      {error && <div className="status error"><AlertTriangle size={15} /> {error}</div>}

      {result && (
        <>
          <div className="summary">
            <div className="stat">
              <b>{visible.length}</b>
              <span><Building size={12} /> {filtersOn ? `of ${result.count} shown` : "leads found"}</span>
            </div>
            <div className="stat">
              <b style={{ color: "var(--hot)" }}>{hot}</b>
              <span><Flame size={12} className="i-hot" /> hot</span>
            </div>
            <div className="stat">
              <b style={{ color: "var(--warm)" }}>{warm}</b>
              <span><Flame size={12} className="i-warm" /> warm</span>
            </div>
            <div className="stat">
              <b style={{ color: "var(--cool)" }}>{freshCount}</b>
              <span><Clock size={12} className="i-cool" /> fresh listings</span>
            </div>
            <div className="stat">
              <b style={{ color: "var(--cool)" }}>{genuineCount}</b>
              <span><Check size={12} className="i-cool" /> genuine (verified)</span>
            </div>
            <div className="stat">
              <b style={{ fontSize: 14, fontWeight: 600 }}>{result.matchedTags.join(", ")}</b>
              <span>matched category</span>
            </div>
            <button className="ghost" onClick={exportCsv} style={{ marginLeft: "auto" }} disabled={!visible.length}>
              <Download size={15} /> Export CSV{filtersOn ? ` (${visible.length})` : ""}
            </button>
          </div>

          <div className="scanline">
            <Clock size={13} /> Scanned <b>{scanAge}</b> · every website re-audited live at search time
          </div>

          {result.notes.map((n, i) => <div key={i} className="status"><Info size={15} /> {n}</div>)}

          <div className="card filters">
            <div className="frow">
              <div className="fgroup grow">
                <label>Search results</label>
                <div className="inputwrap">
                  <Search size={15} />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, category or city…" />
                </div>
              </div>
              <div className="fgroup">
                <label>Sort by</label>
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                  <option value="score">Highest grade</option>
                  <option value="freshest">Freshest listing</option>
                  <option value="name">Name (A–Z)</option>
                </select>
              </div>
              <div className="fgroup">
                <label>Minimum grade: {minScore}</label>
                <input className="range" type="range" min={0} max={100} step={5}
                  value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} />
              </div>
            </div>

            <div className="frow">
              <div className="fgroup">
                <label>Quality</label>
                <div className="chips tight">
                  <span className={`chip toggle ${genuineOnly ? "on" : ""}`}
                    onClick={() => setGenuineOnly((v) => !v)}
                    title="Only verified, reachable leads at an active business">
                    <Check size={12} /> Genuine only
                  </span>
                </div>
              </div>
              <div className="fgroup">
                <label>Tier</label>
                <div className="chips tight">
                  {ALL_TIERS.map((t) => (
                    <span key={t} className={`chip toggle tdot ${t} ${tiers.has(t) ? "on" : ""}`}
                      onClick={() => toggle(tiers, setTiers, t)}>
                      <Dot /> {bandFor(t).label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="fgroup">
                <label>Freshness</label>
                <div className="chips tight">
                  {ALL_FRESHNESS.map((f) => (
                    <span key={f} className={`chip toggle fdot ${f} ${freshLevels.has(f) ? "on" : ""}`}
                      onClick={() => toggle(freshLevels, setFreshLevels, f)}
                      title={freshnessBandFor(f).meaning}>
                      <Dot /> {freshnessBandFor(f).label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="frow">
              <div className="fgroup grow">
                <label>Must have these grade factors</label>
                <div className="chips tight">
                  {FACTOR_CATALOG.map((f) => (
                    <span key={f.key} className={`chip toggle ${reqFactors.has(f.key) ? "on" : ""}`}
                      onClick={() => toggle(reqFactors, setReqFactors, f.key)}
                      title={`${f.why} (+${f.points})`}>
                      {f.label} <b className="pts">+{f.points}</b>
                    </span>
                  ))}
                </div>
              </div>
              {filtersOn && (
                <button className="ghost sm" onClick={resetFilters}>
                  <RotateCcw size={14} /> Reset filters
                </button>
              )}
            </div>
          </div>

          <div className="leads">
            {result.leads.length === 0 && <div className="card empty">No businesses found here. Try a broader location or different niche.</div>}
            {result.leads.length > 0 && visible.length === 0 && (
              <div className="card empty">
                No leads match these filters. <button className="linkish" onClick={resetFilters}>Reset filters</button>
              </div>
            )}
            {visible.map((l) => <LeadCard key={l.id} lead={l} />)}
          </div>
        </>
      )}
    </div>
  );
}

function LeadCard({ lead: l }: { lead: Lead }) {
  const band = bandFor(l.tier);
  const fband = freshnessBandFor(l.freshness);
  const pct = Math.round((l.score / MAX_ATTAINABLE) * 100);

  return (
    <div className="lead">
      <div className={`badge ${l.tier}`} title={`${band.label}: ${band.meaning}`}>
        {l.score}<small>{l.tier}</small>
      </div>
      <div>
        <h3>{l.name}</h3>
        <div className="cat">
          {l.category.replace(/_/g, " ")}{l.city ? ` · ${l.city}` : ""}
          <span className={`fresh ${l.freshness}`} title={fband.meaning}>
            <Dot /> {fband.label} · listing updated {l.freshnessLabel}
          </span>
        </div>
        <div className="meta">
          {l.phone && <span><Phone size={14} /> <a href={`tel:${l.phone}`}>{l.phone}</a></span>}
          {l.email && <span><Mail size={14} /> <a href={`mailto:${l.email}`}>{l.email}</a></span>}
          {l.website
            ? <span><Globe size={14} /> <a href={l.website} target="_blank" rel="noreferrer">website</a></span>
            : <span className="off"><GlobeOff size={14} /> no website</span>}
          <span><MapPin size={14} /> <a href={l.mapUrl} target="_blank" rel="noreferrer">map</a></span>
        </div>
        <div className="verify">
          {l.deliverable && <span className="vbadge good"><Check size={11} /> Genuine</span>}
          {l.phoneValid && <span className="vbadge"><Phone size={11} /> phone verified</span>}
          {l.emailStatus === "deliverable" && <span className="vbadge"><Mail size={11} /> email verified</span>}
          {l.emailStatus === "risky" && <span className="vbadge"><Mail size={11} /> email likely</span>}
          {l.emailStatus === "undeliverable" && <span className="vbadge bad"><Mail size={11} /> email unreachable</span>}
          {l.activeStatus === "active" && <span className="vbadge"><Building size={11} /> active</span>}
          {l.activeStatus === "likely_closed" && <span className="vbadge bad">may be closed</span>}
        </div>
        <div className="signals">
          {l.needSignals.map((s, i) => (
            <span key={i} className={`sig ${/no |not |down|outdated|insecure/i.test(s) ? "bad" : ""}`}>{s}</span>
          ))}
        </div>
        <div className="pitch"><Lightbulb size={14} /> <span>{l.pitch}</span></div>

        <details className="brk">
          <summary>
            <ChevronRight size={13} className="chev" />
            Why grade {l.score}? — {l.scoreFactors.length} factor{l.scoreFactors.length === 1 ? "" : "s"}
          </summary>
          <div className="brkbody">
            {l.scoreFactors.length === 0 && (
              <div className="brkrow muted">Nothing scored — solid web presence and no contact channel found.</div>
            )}
            {l.scoreFactors.map((f) => (
              <div className="brkrow" key={f.key}>
                <span className={`gtag ${f.group}`}>{f.group === "need" ? "NEED" : "REACH"}</span>
                <span className="brklabel">{f.label}</span>
                <span className="brkpts">+{f.points}</span>
              </div>
            ))}
            <div className="brkrow total">
              <span className="brklabel">Total</span>
              <span className="brkpts">{l.score} / {MAX_ATTAINABLE} attainable</span>
            </div>
            <div className="bar"><i className={l.tier} style={{ width: `${pct}%` }} /></div>
            <div className="brknote">
              <b>{band.label}</b> ({band.min}–{band.max}): {band.meaning} <em>{band.action}</em>
            </div>
          </div>
        </details>
      </div>
      <div className="scoreR"><b>{l.score}</b>/100</div>
    </div>
  );
}

function GradeScale({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const need = FACTOR_CATALOG.filter((f) => f.group === "need");
  const reach = FACTOR_CATALOG.filter((f) => f.group === "reach");

  return (
    <div className="card scale">
      <button className="scalehead" onClick={onToggle} aria-expanded={open}>
        <span className="sh-title">
          <Gauge size={16} /> How the grade works — the scale and every factor behind it
        </span>
        <ChevronDown size={15} className={`caret ${open ? "up" : ""}`} />
      </button>

      {open && (
        <div className="scalebody">
          <h4>The 0–100 scale</h4>
          <div className="bands">
            {GRADE_SCALE.map((b) => (
              <div className={`band ${b.tier}`} key={b.tier}>
                <div className="bandhead">
                  <b><Dot /> {b.label}</b><span>{b.min}–{b.max}</span>
                </div>
                <p>{b.meaning}</p>
                <p className="act"><ArrowRight size={13} /> {b.action}</p>
              </div>
            ))}
          </div>
          <p className="note">
            The grade measures <b>opportunity</b>, not business quality: how badly they need work
            (<b>Need</b>) plus how easily you can reach them (<b>Reach</b>). In practice the ceiling
            is <b>{MAX_ATTAINABLE}</b> — a business with no website that lists both a phone and an
            email. The bands are calibrated to that, not to a theoretical 100.
          </p>

          <h4>Need — why they&rsquo;d buy</h4>
          <table className="ftable">
            <tbody>
              {need.map((f) => (
                <tr key={f.key}>
                  <td className="fpts">+{f.points}</td>
                  <td className="flabel">{f.label}</td>
                  <td className="fwhy">{f.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">
            The first two are mutually exclusive with the rest — if there&rsquo;s no site (or it&rsquo;s down),
            we can&rsquo;t audit HTTPS, mobile or copyright age, so only that one factor fires.
          </p>

          <h4>Reach — can you actually close them?</h4>
          <table className="ftable">
            <tbody>
              {reach.map((f) => (
                <tr key={f.key}>
                  <td className="fpts">+{f.points}</td>
                  <td className="flabel">{f.label}</td>
                  <td className="fwhy">{f.why}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4>Lead freshness</h4>
          <p className="note">
            Separate from the grade. Freshness is how recently the underlying business listing was
            confirmed at the source — it tells you whether the phone number is still good.
          </p>
          <div className="bands">
            {FRESHNESS_SCALE.map((b) => (
              <div className={`band fdot ${b.level}`} key={b.level}>
                <div className="bandhead">
                  <b><Dot /> {b.label}</b>
                  <span>{b.maxDays === Infinity ? "2+ yrs" : b.maxDays < 365 ? `≤ ${b.maxDays}d` : `≤ ${Math.round(b.maxDays / 365)}y`}</span>
                </div>
                <p>{b.meaning}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
