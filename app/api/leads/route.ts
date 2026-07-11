import { NextRequest, NextResponse } from "next/server";
import { geocode } from "@/lib/geocode";
import { resolveNiche } from "@/lib/niche";
import { auditWebsite } from "@/lib/audit";
import { scoreLead } from "@/lib/score";
import { assessFreshness } from "@/lib/freshness";
import type { Lead, SearchResult } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { getActiveEntitlement, debitLeads } from "@/lib/gate";
import { stripeConfigured } from "@/lib/stripe";
import { pickSources, mergeRawLeads, type RawLead } from "@/lib/sources";
import { verifyPhone } from "@/lib/verify/phone";
import { verifyEmail } from "@/lib/verify/email";
import { assessActive } from "@/lib/verify/active";

export const runtime = "nodejs";
export const maxDuration = 60;

// Build a Lead skeleton from a source RawLead — audit + verification fill the rest.
function rawToLead(r: RawLead): Lead {
  const fresh = assessFreshness(r.lastUpdated);
  return {
    id: `${r.source}:${r.sourceId}`,
    name: r.name,
    category: r.category,
    phone: r.phone,
    website: r.website,
    email: r.email,
    address: r.address,
    city: r.city,
    lat: r.lat,
    lon: r.lon,
    mapUrl: r.mapUrl,
    hasWebsite: Boolean(r.website),
    siteReachable: null,
    hasSSL: null,
    mobileFriendly: null,
    copyrightYear: null,
    outdated: null,
    lastUpdated: r.lastUpdated,
    freshness: fresh.level,
    freshnessAgeDays: fresh.ageDays,
    freshnessLabel: fresh.ageLabel,
    source: r.source,
    phoneValid: null,
    phoneType: null,
    phoneE164: "",
    emailStatus: "unknown",
    businessStatus: r.businessStatus,
    activeStatus: null,
    deliverable: false,
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

    // Discover from every configured source (OSM free by default; Places when keyed),
    // then merge/dedupe into one raw list.
    const sources = pickSources();
    const lists = await Promise.all(
      sources.map((s) =>
        s.search({ filters: resolved.filters, nicheLabel: resolved.label, area, limit: cap }).catch(() => [])
      )
    );
    const merged = mergeRawLeads(lists);
    const leads: Lead[] = merged.map(rawToLead);

    // Audit websites (SSL/mobile/copyright + scrape a published email). Cap to fit
    // serverless time limits; sites first since they carry the most signal.
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

    // Verify contact channels + active status, then set the "deliverable" gate.
    await mapPool(leads, 12, async (lead) => {
      if (lead.phone) {
        const pv = verifyPhone(lead.phone);
        lead.phoneValid = pv.valid;
        lead.phoneType = pv.type;
        lead.phoneE164 = pv.e164;
      }
      if (lead.email) {
        lead.emailStatus = (await verifyEmail(lead.email)).status;
      }
      lead.activeStatus = assessActive({
        businessStatus: lead.businessStatus,
        hasWebsite: lead.hasWebsite,
        siteReachable: lead.siteReachable,
        freshness: lead.freshness,
      });
      // Genuine + reachable: a verified phone OR a plausible email, and not closed.
      const reachable =
        lead.phoneValid === true || lead.emailStatus === "deliverable" || lead.emailStatus === "risky";
      lead.deliverable = reachable && lead.activeStatus !== "likely_closed";
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
    const actionable = leads.filter((l) => l.phone || l.website || l.email);
    const dropped = leads.length - actionable.length;
    if (dropped > 0) notes.push(`${dropped} unreachable listings (no phone/site/email) were filtered out.`);

    // Sort deliverable (genuine) leads first, then by score.
    actionable.sort((a, b) => Number(b.deliverable) - Number(a.deliverable) || b.score - a.score);
    const top = actionable.slice(0, cap);

    const genuine = top.filter((l) => l.deliverable).length;
    notes.push(`${genuine} of ${top.length} leads passed verification (deliverable contact, active business).`);

    // Debit delivered leads against the paid order (service-role write).
    if (entitlementOrderId && top.length > 0) {
      await debitLeads(entitlementOrderId, top.length);
    }

    const result: SearchResult = {
      niche,
      location,
      resolvedArea: area.displayName,
      matchedTags: [resolved.label, ...sources.map((s) => s.name)],
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
