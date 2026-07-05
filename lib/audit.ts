// Lightweight, best-effort website audit. Fetches the homepage with a short timeout
// and extracts genuine "need" signals: SSL, mobile viewport, copyright year, and any
// real email published on the page.
//
// Accuracy rules (avoid false "down" signals):
//  - ANY HTTP response (even 403/401/429/500) means the site EXISTS and is up.
//    Only a network error or timeout counts as unreachable.
//  - Content signals (mobile/copyright/email) are only trusted on a 2xx HTML body;
//    otherwise they stay null (unknown) rather than fabricating a negative.

export type Audit = {
  reachable: boolean;
  hasSSL: boolean | null;
  mobileFriendly: boolean | null;
  copyrightYear: number | null;
  outdated: boolean | null;
  email: string;
};

const THIS_YEAR = new Date().getFullYear();

async function fetchOnce(url: string, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function auditWebsite(rawUrl: string): Promise<Audit | null> {
  if (!rawUrl) return null;
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  // Single fast attempt (5s) to keep total request time within serverless limits.
  const res = await fetchOnce(url, 5000);

  if (!res) {
    // Genuinely unreachable after both attempts.
    return { reachable: false, hasSSL: null, mobileFriendly: null, copyrightYear: null, outdated: null, email: "" };
  }

  const finalUrl = res.url || url;
  const hasSSL = finalUrl.startsWith("https://");

  // Non-2xx: site is UP but we can't read content — leave content signals unknown.
  if (!res.ok) {
    return { reachable: true, hasSSL, mobileFriendly: null, copyrightYear: null, outdated: null, email: "" };
  }

  let html = "";
  try {
    html = (await res.text()).slice(0, 200_000);
  } catch {
    return { reachable: true, hasSSL, mobileFriendly: null, copyrightYear: null, outdated: null, email: "" };
  }
  const lower = html.toLowerCase();

  const mobileFriendly = /<meta[^>]+name=["']viewport["']/i.test(html);

  // Most recent 4-digit year near a copyright/© marker.
  let copyrightYear: number | null = null;
  const years = [...html.matchAll(/(?:©|copyright|&copy;)[^0-9]{0,20}(20\d{2})/gi)].map((m) =>
    parseInt(m[1], 10)
  );
  if (years.length) copyrightYear = Math.max(...years);
  const outdated = copyrightYear != null && copyrightYear <= THIS_YEAR - 2;

  // A genuine email actually published on the page (mailto or inline).
  let email = "";
  const mailto = html.match(/mailto:([^"'?\s>]+@[^"'?\s>]+)/i);
  if (mailto) email = mailto[1];
  if (!email) {
    const m = lower.match(
      /[a-z0-9._%+-]+@(?!example\.|sentry\.|wixpress\.|\dx\.)[a-z0-9.-]+\.[a-z]{2,}/i
    );
    if (m) email = m[0];
  }

  return { reachable: true, hasSSL, mobileFriendly, copyrightYear, outdated, email };
}
