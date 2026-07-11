import { NextRequest, NextResponse } from "next/server";
import { geocode } from "@/lib/geocode";
import { resolveNiche } from "@/lib/niche";
import { queryOverpass, type OsmElement } from "@/lib/overpass";
import { auditWebsite } from "@/lib/audit";
import { scoreLead } from "@/lib/score";
import { assessFreshness } from "@/lib/freshness";
import type { Lead, SearchResult } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { getActiveEntitlement, debitLeads } from "@/lib/gate";
import { stripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";
export const maxDuration = 60;

const CHAINS = [
  // fast food
  "mcdonald", "burger king", "wendy", "taco bell", "subway", "chipotle",
  "starbucks", "dunkin", "panera", "chick-fil-a", "chick fil a", "popeyes",
  "kfc", "domino", "pizza hut", "little caesar", "jet's pizza", "jets pizza",
  "wingstop", "a&w", "dairy queen", "dave's hot chicken", "daves hot chicken",
  "papa john", "papa murphy", "marco's pizza", "hungry howie", "cottage inn",
  "arby", "sonic drive", "hardee", "carl's jr", "jimmy john", "jersey mike",
  "five guys", "culver", "white castle", "checkers", "del taco", "del boca",
  "panda express", "raising cane", "in-n-out", "whataburger", "tim horton",
  "qdoba", "moe's southwest", "firehouse subs", "buffalo wild wings",
  "applebee", "olive garden", "chili's", "ihop", "denny", "outback",
  "red lobster", "red robin", "texas roadhouse", "cracker barrel", "tgi friday",
  "national coney", "leo's coney", "coney island",
  // retail / big box
  "walmart", "target", "costco", "sam's club", "home depot", "lowe", "menards",
  "best buy", "kroger", "meijer", "aldi", "dollar general", "dollar tree",
  "family dollar", "7-eleven", "circle k", "speedway", "marathon",
  // pharmacy / services
  "cvs", "walgreens", "rite aid", "planet fitness", "anytime fitness",
  "la fitness", "orangetheory", "great clips", "supercuts", "sport clips",
  "jiffy lube", "valvoline", "midas", "pep boys", "aamco", "monro",
  "h&r block", "liberty tax", "state farm", "allstate", "geico", "progressive",
  "u-haul", "enterprise rent", "hertz", "fedex", "ups store", "ace hardware",
  // telecom / bank
  "at&t", "verizon", "t-mobile", "comcast", "xfinity", "chase bank",
  "bank of america", "wells fargo", "pnc bank", "fifth third", "huntington bank",
];

function buildLead(el: OsmElement): Lead | null {
  const t = el.tags || {};
  const name = t.name || t["brand"] || "";
  if (!name) return null;
  if (CHAINS.some((c) => name.toLowerCase().includes(c))) return null;

  const lat = el.lat ?? el.center?.lat ?? 0;
  const lon = el.lon ?? el.center?.lon ?? 0;
  const website = t.website || t["contact:website"] || t.url || "";
  const phone = t.phone || t["contact:phone"] || t["contact:mobile"] || "";
  const category =
    t.shop || t.amenity || t.office || t.craft || t.healthcare || t.tourism || t.leisure || "business";
  const address = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
  const city = t["addr:city"] || "";
  const lastUpdated = el.timestamp ?? null;
  const fresh = assessFreshness(lastUpdated);

  return {
    id: `${el.type}/${el.id}`,
    name,
    category,
    phone,
    website,
    email: t.email || t["contact:email"] || "",
    address,
    city,
    lat,
    lon,
    mapUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    hasWebsite: Boolean(website),
    siteReachable: null,
    hasSSL: null,
    mobileFriendly: null,
    copyrightYear: null,
    outdated: null,
    lastUpdated,
    freshness: fresh.level,
    freshnessAgeDays: fresh.ageDays,
    freshnessLabel: fresh.ageLabel,
    score: 0,
    tier: "COOL",
    scoreFactors: [],
    needSignals: [],
    pitch: "",
  };
}

// Run async tasks with a concurrency cap.
async function mapPool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const { niche, location, limit } = await req.json();
    if (!niche || !location) {
      return NextResponse.json({ error: "niche and location are required" }, { status: 400 });
    }
    let cap = Math.min(Math.max(parseInt(String(limit)) || 40, 1), 80);
    const notes: string[] = [];

    // Gate: when payments are configured, require auth + a paid, in-quota order,
    // and clamp the request to remaining quota. Demo deployments (no Stripe) are open.
    let entitlementOrderId: string | null = null;
    if (stripeConfigured()) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

      const entitlement = await getActiveEntitlement(user.id);
      if (!entitlement) {
        return NextResponse.json(
          { error: "No active plan. Get a quote to start.", code: "payment_required" },
          { status: 402 }
        );
      }
      entitlementOrderId = entitlement.orderId;
      cap = Math.min(cap, entitlement.remaining);
      if (cap <= 0) {
        return NextResponse.json(
          { error: "Lead quota used up for this period.", code: "quota_exhausted" },
          { status: 402 }
        );
      }
    }

    const area = await geocode(location);
    if (!area) {
      return NextResponse.json({ error: `Couldn't find location "${location}".` }, { status: 404 });
    }

    const resolved = resolveNiche(niche);
    if (resolved.generic) notes.push("Unknown niche — matched by business name, coverage may vary.");

    const elements = await queryOverpass(resolved.filters, area, cap);

    // Dedupe by name+coords, build leads.
    const seen = new Set<string>();
    const leads: Lead[] = [];
    for (const el of elements) {
      const lead = buildLead(el);
      if (!lead) continue;
      const key = lead.name.toLowerCase() + "|" + lead.lat.toFixed(3) + lead.lon.toFixed(3);
      if (seen.has(key)) continue;
      seen.add(key);
      leads.push(lead);
    }

    // Prioritize auditing: businesses with websites (need the audit) first, then no-site.
    // Cap audit work so requests finish well within serverless time limits.
    const withSite = leads.filter((l) => l.hasWebsite).slice(0, 24);
    await mapPool(withSite, 12, async (lead) => {
      const audit = await auditWebsite(lead.website);
      if (audit) {
        lead.siteReachable = audit.reachable;
        lead.hasSSL = audit.hasSSL;
        lead.mobileFriendly = audit.mobileFriendly;
        lead.copyrightYear = audit.copyrightYear;
        lead.outdated = audit.outdated;
        if (!lead.email && audit.email) lead.email = audit.email;
      }
    });

    for (const lead of leads) {
      const s = scoreLead(lead);
      lead.score = s.score;
      lead.tier = s.tier;
      lead.scoreFactors = s.factors;
      lead.needSignals = s.signals;
      lead.pitch = s.pitch;
    }

    // Only keep ACTIONABLE leads — you must be able to reach them at all.
    // A business with no phone, no website, and no email is not a workable lead.
    const actionable = leads.filter((l) => l.phone || l.website || l.email);
    const dropped = leads.length - actionable.length;
    if (dropped > 0) notes.push(`${dropped} unreachable listings (no phone/site/email) were filtered out.`);

    actionable.sort((a, b) => b.score - a.score);
    const top = actionable.slice(0, cap);

    // Debit delivered leads against the paid order (service-role write).
    if (entitlementOrderId && top.length > 0) {
      await debitLeads(entitlementOrderId, top.length);
    }

    const result: SearchResult = {
      niche,
      location,
      resolvedArea: area.displayName,
      matchedTags: [resolved.label],
      count: top.length,
      leads: top,
      notes,
      scannedAt: new Date().toISOString(),
    };
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Lead search failed: ${msg}` }, { status: 500 });
  }
}
