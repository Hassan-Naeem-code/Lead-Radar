"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Billing } from "@/lib/quote";
import { ArrowRight } from "../icons";

// Persists the chosen quote server-side (price of record) then proceeds to checkout.
export function QuoteChoice({
  businessProfileId,
  billing,
  label,
}: {
  businessProfileId: string;
  billing: Billing;
  label: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function choose() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_profile_id: businessProfileId, billing }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create quote");
      router.push(`/checkout?quote=${data.quoteId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <>
      <button className="go" onClick={choose} disabled={loading}>
        {loading ? "Preparing…" : <>{label} <ArrowRight size={16} /></>}
      </button>
      {error && <div className="status error">{error}</div>}
    </>
  );
}
