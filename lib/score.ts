import type { Lead, ScoreFactor } from "./types";

// Score a lead on GENUINE NEED (do they lack a solid web presence / could use work?)
// plus CONTACTABILITY (can you actually reach them?). Higher = hotter opportunity.
//
// Every point is attributable to exactly one factor in FACTOR_CATALOG below, so the UI
// can show a full "why this grade" breakdown instead of an opaque number.

export type GradeBand = {
  tier: Lead["tier"];
  min: number;
  max: number;
  label: string;
  meaning: string;
  action: string;
};

/** The published grade scale. Thresholds here are the ONLY place tiers are defined. */
export const GRADE_SCALE: GradeBand[] = [
  {
    tier: "HOT",
    min: 70,
    max: 100,
    label: "Hot",
    meaning: "A clear, urgent gap in their web presence — and you can reach them today.",
    action: "Call first. Open with the specific problem you found.",
  },
  {
    tier: "WARM",
    min: 40,
    max: 69,
    label: "Warm",
    meaning: "Real gaps worth fixing, or easy to reach but only partly qualified.",
    action: "Worth an email sequence. Warm them up before pitching.",
  },
  {
    tier: "COOL",
    min: 0,
    max: 39,
    label: "Cool",
    meaning: "Solid presence, or hard to reach — no obvious pain to sell against.",
    action: "Low priority. Approach with a growth/AI angle, not a rebuild.",
  },
];

export function tierFor(score: number): Lead["tier"] {
  return (GRADE_SCALE.find((b) => score >= b.min) ?? GRADE_SCALE[GRADE_SCALE.length - 1]).tier;
}

export function bandFor(tier: Lead["tier"]): GradeBand {
  return GRADE_SCALE.find((b) => b.tier === tier)!;
}

export type FactorSpec = {
  key: string;
  group: "need" | "reach";
  points: number;
  label: string;
  why: string;
  /** Factors in the same slot are mutually exclusive — only the first match fires. */
  slot: string;
};

/**
 * Everything that can move the grade. Rendered verbatim in the "How the grade works"
 * panel, and used to drive the filter checkboxes — one source of truth.
 */
export const FACTOR_CATALOG: FactorSpec[] = [
  {
    key: "no_website",
    group: "need",
    points: 55,
    slot: "presence",
    label: "No website at all",
    why: "Nothing to defend and nothing to rebuild around — the biggest, cleanest sale.",
  },
  {
    key: "site_down",
    group: "need",
    points: 50,
    slot: "presence",
    label: "Website down / unreachable",
    why: "They are losing customers this minute. The most urgent call you can make.",
  },
  {
    key: "no_ssl",
    group: "need",
    points: 20,
    slot: "ssl",
    label: "No HTTPS (insecure)",
    why: "Browsers show visitors a 'Not secure' warning. Concrete and easy to demo.",
  },
  {
    key: "not_mobile",
    group: "need",
    points: 16,
    slot: "mobile",
    label: "Not mobile-friendly",
    why: "More than half their traffic is on a phone and it renders badly.",
  },
  {
    key: "outdated",
    group: "need",
    points: 12,
    slot: "outdated",
    label: "Outdated site (copyright 2+ years old)",
    why: "Signals nobody maintains it — low resistance to a rebuild pitch.",
  },
  {
    key: "phone",
    group: "reach",
    points: 18,
    slot: "phone",
    label: "Phone number listed",
    why: "You can close on a call instead of waiting on email.",
  },
  {
    key: "email",
    group: "reach",
    points: 12,
    slot: "email",
    label: "Email published",
    why: "Unlocks automated outreach sequences.",
  },
];

export function factorSpec(key: string): FactorSpec {
  return FACTOR_CATALOG.find((f) => f.key === key)!;
}

const inSlot = (slot: string) => FACTOR_CATALOG.filter((f) => f.slot === slot);
const sum = (fs: FactorSpec[]) => fs.reduce((a, f) => a + f.points, 0);

/**
 * Highest score any real lead can reach. The two need paths are exclusive: either the
 * site is absent/down (best: no website, 55), or it's live but flawed (20 + 16 + 12 = 48).
 * Add both contactability factors (30) and the ceiling is 85 — the bands are calibrated
 * against that, not a theoretical 100.
 */
export const MAX_ATTAINABLE = Math.min(
  100,
  Math.max(
    Math.max(...inSlot("presence").map((f) => f.points)),
    sum([...inSlot("ssl"), ...inSlot("mobile"), ...inSlot("outdated")]),
  ) + sum(FACTOR_CATALOG.filter((f) => f.group === "reach")),
);

export function scoreLead(l: Lead): {
  score: number;
  tier: Lead["tier"];
  signals: string[];
  factors: ScoreFactor[];
  pitch: string;
} {
  const factors: ScoreFactor[] = [];
  const signals: string[] = [];

  const fire = (key: string) => {
    const spec = factorSpec(key);
    factors.push({ key: spec.key, label: spec.label, points: spec.points, group: spec.group });
    signals.push(spec.label);
  };

  // --- Need signals (the reason they'd buy) ---
  if (!l.hasWebsite) {
    fire("no_website");
  } else if (l.siteReachable === false) {
    fire("site_down");
  } else {
    if (l.hasSSL === false) fire("no_ssl");
    if (l.mobileFriendly === false) fire("not_mobile");
    if (l.outdated) {
      fire("outdated");
      // Replace the generic catalog label with the concrete year we actually found.
      signals[signals.length - 1] = `Outdated site (©${l.copyrightYear})`;
    }
    if (l.hasSSL && l.mobileFriendly && !l.outdated) signals.push("Solid site — lower urgency");
  }

  // --- Contactability (can you actually close them?) ---
  if (l.phone) fire("phone");
  else signals.push("No phone listed");

  if (l.email) fire("email");

  const raw = factors.reduce((sum, f) => sum + f.points, 0);
  const score = Math.max(0, Math.min(100, raw));

  return { score, tier: tierFor(score), signals, factors, pitch: buildPitch(l, signals) };
}

function buildPitch(l: Lead, signals: string[]): string {
  if (!l.hasWebsite)
    return `${l.name} has no website — lead with a fast, modern site + Google presence to capture the customers they're losing.`;
  if (l.siteReachable === false)
    return `${l.name}'s website is down — urgent rebuild opportunity; they're actively losing business right now.`;
  const problems: string[] = [];
  if (l.hasSSL === false) problems.push("no HTTPS");
  if (l.mobileFriendly === false) problems.push("not mobile-friendly");
  if (l.outdated) problems.push(`last updated ${l.copyrightYear}`);
  if (problems.length)
    return `${l.name}'s site is ${problems.join(", ")} — pitch a redesign that ranks and converts better.`;
  return `${l.name} has a decent site — approach with a growth/AI angle (automation, chatbot, SEO) rather than a rebuild.`;
}
