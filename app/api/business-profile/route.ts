import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  niche: z.string().min(1).max(120),
  target_customer: z.string().max(200).optional().default(""),
  location: z.string().min(1).max(160),
  radius_km: z.number().int().min(1).max(200),
  monthly_lead_volume: z.number().int().min(1).max(5000),
  min_quality_score: z.number().int().min(0).max(100),
  quality_requirements: z
    .object({
      requireEmail: z.boolean().optional(),
      requirePhone: z.boolean().optional(),
      requireActive: z.boolean().optional(),
    })
    .optional(),
});

// Upsert the caller's business/needs profile. Latest row wins (read with newest-first).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid form data", issues: parsed.error.issues }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("business_profiles")
    .insert({ user_id: user.id, ...parsed.data })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

// Return the caller's most recent business profile (used to pre-fill the dashboard).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ profile: data ?? null });
}
