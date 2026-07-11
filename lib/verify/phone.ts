import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

// Free-floor phone validation — pure, offline, instant (no network). Proves the
// number is well-formed and gives its line type; it does NOT prove the line is
// live (that needs a paid lookup — the Twilio seam below).
export type PhoneVerdict = {
  valid: boolean;
  e164: string;
  national: string;
  type: string | null; // mobile | fixed_line | voip | toll_free | ...
  reachable: boolean | null; // null until a paid lookup confirms
};

const FAKE = /^(\d)\1{6,}$/; // 0000000000, 1111111111, ...

export function verifyPhone(raw: string, region: CountryCode = "US"): PhoneVerdict {
  const empty: PhoneVerdict = { valid: false, e164: "", national: "", type: null, reachable: null };
  if (!raw) return empty;

  const digits = raw.replace(/\D/g, "");
  if (!digits || FAKE.test(digits)) return empty;

  const parsed = parsePhoneNumberFromString(raw, region);
  if (!parsed || !parsed.isValid()) return empty;

  return {
    valid: true,
    e164: parsed.number,
    national: parsed.formatNational(),
    type: parsed.getType() ?? "unknown",
    reachable: null, // TODO(paid): Twilio Lookup fills line status when TWILIO_* is set
  };
}
