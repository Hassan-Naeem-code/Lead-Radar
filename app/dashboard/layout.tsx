import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RadarMark } from "../icons";

// The real gate for the app. Middleware does a coarse auth redirect; this re-checks the
// user server-side and (from Phase 4) will also require a paid, in-quota order.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/dashboard");

  // PAYMENT GATE — wired in Phase 4. For now every authenticated user is allowed in.
  // const entitlement = await getActiveEntitlement(user.id);
  // if (!entitlement) redirect("/quote");

  return (
    <div>
      <header className="topbar">
        <Link href="/dashboard" className="topbrand">
          <span className="logo sm">
            <RadarMark size={16} />
          </span>
          LeadRadar
        </Link>
        <div className="topright">
          <span className="topuser">{user.email}</span>
          <Link href="/dashboard/history" className="toplink">
            History
          </Link>
          <form action="/auth/signout" method="post">
            <button className="ghost sm" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
