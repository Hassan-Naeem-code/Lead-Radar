import type { LeadSource, RawLead } from "./types";
import { OverpassSource } from "./overpass-source";
import { GooglePlacesSource } from "./google-places-source";

// All configured sources, richest first. OSM is always on (free); Places joins
// automatically once GOOGLE_PLACES_API_KEY is set.
export function pickSources(): LeadSource[] {
  return [new GooglePlacesSource(), new OverpassSource()].filter((s) => s.isConfigured());
}

// Merge across sources, deduping by name+location and by phone, preferring the
// richer record (Places over OSM) when the same business appears twice.
export function mergeRawLeads(lists: RawLead[][]): RawLead[] {
  const byKey = new Map<string, RawLead>();
  const rank: Record<RawLead["source"], number> = { google_places: 2, osm: 1 };

  const keysFor = (l: RawLead) => {
    const geo = `${l.name.toLowerCase()}|${l.lat.toFixed(3)}|${l.lon.toFixed(3)}`;
    const phone = l.phone ? `p:${l.phone.replace(/\D/g, "")}` : null;
    return [geo, phone].filter(Boolean) as string[];
  };

  for (const list of lists) {
    for (const lead of list) {
      const keys = keysFor(lead);
      const existingKey = keys.find((k) => byKey.has(k));
      if (existingKey) {
        const cur = byKey.get(existingKey)!;
        if (rank[lead.source] > rank[cur.source]) {
          for (const k of keys) byKey.set(k, lead);
        }
      } else {
        for (const k of keys) byKey.set(k, lead);
      }
    }
  }
  // De-duplicate the values (a lead may be under multiple keys).
  return Array.from(new Set(byKey.values()));
}

export type { RawLead, LeadSource } from "./types";
