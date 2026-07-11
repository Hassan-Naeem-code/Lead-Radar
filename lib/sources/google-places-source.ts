import type { GeoArea } from "../geocode";
import type { LeadSource, RawLead } from "./types";

// Richer data source — Google Places (New) Text Search. DORMANT until
// GOOGLE_PLACES_API_KEY is set; it then drops in behind the same LeadSource
// interface with no other pipeline changes. Places supplies phone, website, and
// business status directly (the "richer data" + "active business" signals).
export class GooglePlacesSource implements LeadSource {
  readonly name = "google_places" as const;

  isConfigured() {
    return Boolean(process.env.GOOGLE_PLACES_API_KEY);
  }

  async search(params: {
    filters: string[];
    nicheLabel: string;
    area: GeoArea;
    limit: number;
  }): Promise<RawLead[]> {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) return [];

    const [south, north, west, east] = params.area.bbox;
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location," +
          "places.nationalPhoneNumber,places.websiteUri,places.businessStatus,places.primaryType",
      },
      body: JSON.stringify({
        textQuery: `${params.nicheLabel} in ${params.area.displayName}`,
        maxResultCount: Math.min(params.limit, 20),
        locationRestriction: {
          rectangle: {
            low: { latitude: south, longitude: west },
            high: { latitude: north, longitude: east },
          },
        },
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { places?: PlaceResult[] };

    return (data.places ?? []).map((p) => mapPlace(p));
  }
}

type PlaceResult = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  businessStatus?: string;
  primaryType?: string;
};

function mapPlace(p: PlaceResult): RawLead {
  const status = p.businessStatus;
  return {
    sourceId: p.id,
    source: "google_places",
    name: p.displayName?.text ?? "",
    category: p.primaryType ?? "business",
    phone: p.nationalPhoneNumber ?? "",
    website: p.websiteUri ?? "",
    email: "",
    address: p.formattedAddress ?? "",
    city: "",
    lat: p.location?.latitude ?? 0,
    lon: p.location?.longitude ?? 0,
    mapUrl: `https://www.google.com/maps/place/?q=place_id:${p.id}`,
    lastUpdated: null,
    businessStatus:
      status === "OPERATIONAL"
        ? "operational"
        : status === "CLOSED_TEMPORARILY"
          ? "closed_temporarily"
          : status === "CLOSED_PERMANENTLY"
            ? "closed_permanently"
            : null,
  };
}
