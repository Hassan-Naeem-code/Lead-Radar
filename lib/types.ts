import type { FreshnessLevel } from "./freshness";

/** One line item of the 0–100 grade: what fired, and how many points it contributed. */
export type ScoreFactor = {
  key: string;
  label: string;
  points: number;
  group: "need" | "reach";
};

export type Lead = {
  id: string;
  name: string;
  category: string;
  phone: string;
  website: string;
  email: string;
  address: string;
  city: string;
  lat: number;
  lon: number;
  mapUrl: string;
  // audit signals
  hasWebsite: boolean;
  siteReachable: boolean | null;
  hasSSL: boolean | null;
  mobileFriendly: boolean | null;
  copyrightYear: number | null;
  outdated: boolean | null;
  // freshness — how current the underlying listing is
  lastUpdated: string | null;
  freshness: FreshnessLevel;
  freshnessAgeDays: number | null;
  freshnessLabel: string;
  // scoring
  score: number;
  tier: "HOT" | "WARM" | "COOL";
  scoreFactors: ScoreFactor[];
  needSignals: string[];
  pitch: string;
};

export type SearchResult = {
  niche: string;
  location: string;
  resolvedArea: string;
  matchedTags: string[];
  count: number;
  leads: Lead[];
  notes: string[];
  /** ISO time this search ran — the "scanned at" clock for every lead in it. */
  scannedAt: string;
};
