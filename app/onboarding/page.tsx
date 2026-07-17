"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FreshLeadsMark, ArrowRight, AlertTriangle } from "../icons";

const RADII = [
  { km: 15, label: "Local (15 km)" },
  { km: 25, label: "City-wide (25 km)" },
  { km: 50, label: "Metro (50 km)" },
  { km: 100, label: "Regional (100 km)" },
];

const QUALITY = [
  { score: 0, label: "All qualified leads" },
  { score: 40, label: "Warm & up (grade 40+)" },
  { score: 70, label: "Hot only (grade 70+)" },
];

export default function Onboarding() {
  const router = useRouter();
  const [niche, setNiche] = useState("");
  const [targetCustomer, setTargetCustomer] = useState("");
  const [location, setLocation] = useState("");
  const [radiusKm, setRadiusKm] = useState(25);
  const [volume, setVolume] = useState(100);
  const [minScore, setMinScore] = useState(0);
  const [requireEmail, setRequireEmail] = useState(true);
  const [requirePhone, setRequirePhone] = useState(false);
  const [requireActive, setRequireActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/business-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche,
          target_customer: targetCustomer,
          location,
          radius_km: radiusKm,
          monthly_lead_volume: volume,
          min_quality_score: minScore,
          quality_requirements: { requireEmail, requirePhone, requireActive },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save your profile");
      router.push(`/quote?bp=${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="wrap onboard">
      <div className="brand">
        <div className="logo"><FreshLeadsMark size={22} /></div>
        <h1>Define your ideal lead</h1>
      </div>
      <p className="tag">Tell us who you want to reach. We&rsquo;ll price a plan around exactly that.</p>

      <form className="card obform" onSubmit={onSubmit}>
        <div className="obrow">
          <div className="obfield">
            <label>Business niche you want as leads</label>
            <input value={niche} onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. dentists, hvac contractors, law firms" required />
          </div>
          <div className="obfield">
            <label>Who do you sell to? (optional)</label>
            <input value={targetCustomer} onChange={(e) => setTargetCustomer(e.target.value)}
              placeholder="e.g. clinics needing a new website" />
          </div>
        </div>

        <div className="obrow">
          <div className="obfield">
            <label>Location / market</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Warren, MI" required />
          </div>
          <div className="obfield">
            <label>Coverage radius</label>
            <select value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))}>
              {RADII.map((r) => <option key={r.km} value={r.km}>{r.label}</option>)}
            </select>
          </div>
        </div>

        <div className="obrow">
          <div className="obfield">
            <label>Leads per month: <b>{volume}</b></label>
            <input className="range" type="range" min={10} max={1000} step={10}
              value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
          </div>
          <div className="obfield">
            <label>Quality bar</label>
            <select value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}>
              {QUALITY.map((q) => <option key={q.score} value={q.score}>{q.label}</option>)}
            </select>
          </div>
        </div>

        <div className="obfield">
          <label>Every lead must have</label>
          <div className="chips tight">
            <span className={`chip toggle ${requireEmail ? "on" : ""}`} onClick={() => setRequireEmail((v) => !v)}>
              Verified email
            </span>
            <span className={`chip toggle ${requirePhone ? "on" : ""}`} onClick={() => setRequirePhone((v) => !v)}>
              Verified phone
            </span>
            <span className={`chip toggle ${requireActive ? "on" : ""}`} onClick={() => setRequireActive((v) => !v)}>
              Confirmed active
            </span>
          </div>
        </div>

        {error && <div className="status error"><AlertTriangle size={15} /> {error}</div>}

        <button className="go" type="submit" disabled={loading}>
          {loading ? "Building your quote…" : <>See my custom quote <ArrowRight size={16} /></>}
        </button>
      </form>
    </div>
  );
}
