import type { Lead } from "./types";

// Score a lead on GENUINE NEED (do they lack a solid web presence / could use work?)
// plus CONTACTABILITY (can you actually reach them?). Higher = hotter opportunity.
export function scoreLead(l: Lead): { score: number; tier: Lead["tier"]; signals: string[]; pitch: string } {
  let score = 0;
  const signals: string[] = [];

  // --- Need signals (the reason they'd buy) ---
  if (!l.hasWebsite) {
    score += 55;
    signals.push("No website at all");
  } else if (l.siteReachable === false) {
    score += 50;
    signals.push("Website is down / unreachable");
  } else {
    if (l.hasSSL === false) {
      score += 20;
      signals.push("No HTTPS (insecure site)");
    }
    if (l.mobileFriendly === false) {
      score += 16;
      signals.push("Not mobile-friendly");
    }
    if (l.outdated) {
      score += 12;
      signals.push(`Outdated site (©${l.copyrightYear})`);
    }
    if (l.hasSSL && l.mobileFriendly && !l.outdated) {
      signals.push("Solid site — lower urgency");
    }
  }

  // --- Contactability (can you actually close them?) ---
  if (l.phone) {
    score += 18;
  } else {
    signals.push("No phone listed");
  }
  if (l.email) {
    score += 12;
    signals.push("Real email found on site");
  }

  score = Math.max(0, Math.min(100, score));
  const tier: Lead["tier"] = score >= 70 ? "HOT" : score >= 40 ? "WARM" : "COOL";

  return { score, tier, signals, pitch: buildPitch(l, signals) };
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
