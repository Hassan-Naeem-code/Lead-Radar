// Custom-quote engine — SERVER-ONLY, pure. Given a customer's needs, compute a
// transparent, tamper-proof price. The client never sends a price; this is the single
// source of truth, recomputed at /api/quote and again at /api/checkout.
//
// Positioning: premium, verified leads at ~$8–12 each. Higher volume earns a bulk
// discount; a stricter quality bar (HOT-only leads are rarer) costs more. All knobs live
// in PRICING below so the numbers are easy to tune without touching the logic.

export type Billing = "monthly" | "one_time";

export type QuoteInput = {
  monthlyLeadVolume: number;
  minQualityScore: number; // 0-100 (ties to lib/score.ts GRADE_SCALE)
  radiusKm: number;
  billing: Billing;
};

export type QuoteLine = {
  label: string;
  detail: string;
  /** Signed cents this line contributes to the per-lead unit price (for transparency). */
  unitDeltaCents?: number;
};

export type Quote = {
  volume: number;
  billing: Billing;
  unitPriceCents: number;
  amountCents: number;
  currency: "usd";
  leadQuota: number;
  breakdown: QuoteLine[];
};

const PRICING = {
  currency: "usd" as const,
  // Per-lead base price by volume band (cents). Bulk buyers pay less per lead.
  volumeBands: [
    { maxVolume: 49, unitCents: 1200 },
    { maxVolume: 199, unitCents: 1000 },
    { maxVolume: 499, unitCents: 900 },
    { maxVolume: Infinity, unitCents: 800 },
  ],
  // Quality multiplier: a higher minimum grade means rarer, harder-won leads.
  qualityTiers: [
    { minScore: 70, multiplier: 1.4, label: "Hot-only (grade 70+)" },
    { minScore: 40, multiplier: 1.2, label: "Warm & up (grade 40+)" },
    { minScore: 1, multiplier: 1.05, label: "Above cool (grade 1+)" },
    { minScore: 0, multiplier: 1.0, label: "All qualified leads" },
  ],
  // Wide coverage areas cost more to source/verify.
  wideRadiusKm: 50,
  wideRadiusMultiplier: 1.1,
  // Committing to a monthly plan earns a standing discount vs. a one-time pack.
  monthlyCommitmentMultiplier: 0.9,
  minVolume: 10,
  maxVolume: 5000,
};

function volumeBand(volume: number) {
  return PRICING.volumeBands.find((b) => volume <= b.maxVolume) ?? PRICING.volumeBands.at(-1)!;
}

function qualityTier(minScore: number) {
  return PRICING.qualityTiers.find((t) => minScore >= t.minScore) ?? PRICING.qualityTiers.at(-1)!;
}

export function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return PRICING.minVolume;
  return Math.min(PRICING.maxVolume, Math.max(PRICING.minVolume, Math.round(v)));
}

// Round a per-lead price to a clean quarter-dollar so quotes read nicely.
function roundUnit(cents: number): number {
  return Math.round(cents / 25) * 25;
}

export function computeQuote(input: QuoteInput): Quote {
  const volume = clampVolume(input.monthlyLeadVolume);
  const band = volumeBand(volume);
  const quality = qualityTier(Math.max(0, Math.min(100, input.minQualityScore)));
  const wide = input.radiusKm >= PRICING.wideRadiusKm;

  const base = band.unitCents;
  const afterQuality = base * quality.multiplier;
  const afterRadius = afterQuality * (wide ? PRICING.wideRadiusMultiplier : 1);
  const afterBilling =
    afterRadius * (input.billing === "monthly" ? PRICING.monthlyCommitmentMultiplier : 1);

  const unitPriceCents = roundUnit(afterBilling);
  const amountCents = unitPriceCents * volume;

  const breakdown: QuoteLine[] = [
    {
      label: "Base rate",
      detail: `${volume} leads → $${(base / 100).toFixed(2)}/lead volume band`,
      unitDeltaCents: base,
    },
    {
      label: "Quality",
      detail: `${quality.label} · ×${quality.multiplier}`,
      unitDeltaCents: Math.round(afterQuality - base),
    },
  ];
  if (wide) {
    breakdown.push({
      label: "Wide coverage",
      detail: `${input.radiusKm} km radius · ×${PRICING.wideRadiusMultiplier}`,
      unitDeltaCents: Math.round(afterRadius - afterQuality),
    });
  }
  if (input.billing === "monthly") {
    breakdown.push({
      label: "Monthly commitment",
      detail: `×${PRICING.monthlyCommitmentMultiplier} standing discount`,
      unitDeltaCents: Math.round(afterBilling - afterRadius),
    });
  }
  breakdown.push({
    label: "Per verified lead",
    detail: input.billing === "monthly" ? "billed monthly" : "one-time pack",
    unitDeltaCents: unitPriceCents,
  });

  return {
    volume,
    billing: input.billing,
    unitPriceCents,
    amountCents,
    currency: PRICING.currency,
    leadQuota: volume,
    breakdown,
  };
}

// Convenience: both billing options for the quote page's side-by-side choice.
export function computeQuoteOptions(input: Omit<QuoteInput, "billing">): {
  monthly: Quote;
  one_time: Quote;
} {
  return {
    monthly: computeQuote({ ...input, billing: "monthly" }),
    one_time: computeQuote({ ...input, billing: "one_time" }),
  };
}
