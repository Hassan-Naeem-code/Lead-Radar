import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Past lead batches. Fully populated in Phase 5 once searches persist to Supabase.
export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: batches } = await supabase
    .from("lead_batches")
    .select("id, niche, location, lead_count, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="wrap">
      <div className="brand">
        <h1>Search history</h1>
      </div>
      <p className="tag">Every batch of leads you&rsquo;ve pulled.</p>

      {!batches || batches.length === 0 ? (
        <div className="card empty">
          No searches yet. <Link href="/dashboard" className="linkish">Run your first search</Link>.
        </div>
      ) : (
        <div className="leads">
          {batches.map((b) => (
            <div className="lead" key={b.id} style={{ gridTemplateColumns: "1fr auto" }}>
              <div>
                <h3>
                  {b.niche} · {b.location}
                </h3>
                <div className="cat">{new Date(b.created_at).toLocaleString()}</div>
              </div>
              <div className="scoreR">
                <b>{b.lead_count}</b>leads
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
