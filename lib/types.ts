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
  // scoring
  score: number;
  tier: "HOT" | "WARM" | "COOL";
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
};
