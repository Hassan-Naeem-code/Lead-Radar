import Link from "next/link";
import { RadarMark } from "../../icons";

export default function CheckoutCancel() {
  return (
    <div className="wrap">
      <div className="brand">
        <div className="logo"><RadarMark size={22} /></div>
        <h1>Checkout canceled</h1>
      </div>
      <div className="card" style={{ maxWidth: 520 }}>
        <p className="note">No charge was made. You can review your quote and try again whenever you&rsquo;re ready.</p>
        <Link href="/quote" className="linkish" style={{ display: "inline-block", marginTop: 12 }}>
          ← Back to your quote
        </Link>
      </div>
    </div>
  );
}
