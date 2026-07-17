import Link from "next/link";
import { FreshLeadsMark, Check, ArrowRight } from "../../icons";

// Confirmation only. Access is granted by the Stripe webhook, not this page.
export default function CheckoutSuccess() {
  return (
    <div className="wrap">
      <div className="brand">
        <div className="logo"><FreshLeadsMark size={22} /></div>
        <h1>You&rsquo;re in</h1>
      </div>
      <div className="card" style={{ maxWidth: 520 }}>
        <p style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Check size={20} className="i-cool" /> Payment received — your lead quota is active.
        </p>
        <p className="note">
          If your dashboard still shows locked for a moment, give the payment a few seconds to
          confirm, then refresh.
        </p>
        <Link href="/dashboard" className="lp-cta" style={{ marginTop: 16, display: "inline-flex" }}>
          Go to your dashboard <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
