import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().max(120).optional().default(""),
});

// Instant signup: create a PRE-CONFIRMED user via the admin API, so no email
// confirmation step is needed and signup works the moment they submit. The
// payment gate is what verifies real customers. The client signs in afterwards
// to get a session. (Swap back to email confirmation once a real mail provider
// is wired up.)
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email and a password of at least 6 characters." },
      { status: 400 }
    );
  }
  const { email, password, fullName } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) {
    const exists = /already|exists|registered/i.test(error.message);
    return NextResponse.json(
      { error: exists ? "An account with this email already exists — sign in instead." : error.message },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
