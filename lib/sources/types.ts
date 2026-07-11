import type { GeoArea } from "../geocode";

// A business as returned by a data source, BEFORE auditing/verification/scoring.
// Every source (free OpenStreetMap now, Google Places later) maps into this shape
// so the rest of the pipeline is source-agnostic.
export type RawLead = {
  sourceId: string;
  source: LeadSourceName;
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
  lastUpdated: string | null;
  // Positive-only "is it operating" hint the source may supply (Places yes, OSM no).
  businessStatus: "operational" | "closed_temporarily" | "closed_permanently" | null;
};

export type LeadSourceName = "osm" | "google_places";

export interface LeadSource {
  readonly name: LeadSourceName;
  /** Usable right now? (keys present, etc.) */
  isConfigured(): boolean;
  /** Discover businesses for a resolved niche in a geo area. */
  search(params: {
    filters: string[];
    nicheLabel: string;
    area: GeoArea;
    limit: number;
  }): Promise<RawLead[]>;
}
