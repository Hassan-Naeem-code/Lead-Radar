import { promises as dns } from "dns";
import { DISPOSABLE_DOMAINS, ROLE_PREFIXES } from "./disposable-domains";

// Free-floor email verification that runs inside a serverless request: syntax,
// disposable-domain, and MX-record checks. It does NOT open an SMTP session (port
// 25 is blocked on Vercel and most hosts) — so a syntactically valid address with
// MX records is reported as "risky" (probably reachable, not proven), never a
// false "deliverable". A paid verifier (ZeroBounce/NeverBounce) or an always-on
// worker doing the SMTP handshake is the upgrade seam that yields true "deliverable".
export type EmailStatus = "deliverable" | "risky" | "undeliverable" | "unknown";

export type EmailVerdict = {
  status: EmailStatus;
  syntaxOk: boolean;
  mxOk: boolean;
  disposable: boolean;
  role: boolean;
};

const SYNTAX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Per-request MX cache — the same domain often recurs across leads.
const mxCache = new Map<string, boolean>();

async function hasMx(domain: string): Promise<boolean> {
  if (mxCache.has(domain)) return mxCache.get(domain)!;
  let ok = false;
  try {
    const records = await dns.resolveMx(domain);
    ok = Array.isArray(records) && records.length > 0;
  } catch {
    ok = false;
  }
  mxCache.set(domain, ok);
  return ok;
}

export async function verifyEmail(email: string): Promise<EmailVerdict> {
  const e = (email || "").trim().toLowerCase();
  if (!e) return { status: "unknown", syntaxOk: false, mxOk: false, disposable: false, role: false };

  const syntaxOk = SYNTAX.test(e);
  const [local, domain] = e.split("@");
  const disposable = !!domain && DISPOSABLE_DOMAINS.has(domain);
  const role = !!local && ROLE_PREFIXES.has(local);

  if (!syntaxOk || disposable) {
    return { status: "undeliverable", syntaxOk, mxOk: false, disposable, role };
  }

  const mxOk = await hasMx(domain);
  if (!mxOk) return { status: "undeliverable", syntaxOk, mxOk, disposable, role };

  // Syntax + MX pass. Without an SMTP probe we cap at "risky" (probably reachable).
  // TODO(paid): if ZEROBOUNCE_API_KEY is set, call it here and return "deliverable".
  return { status: "risky", syntaxOk, mxOk, disposable, role };
}
