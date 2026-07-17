"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { FreshLeadsMark } from "../../icons";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<null | "confirm" | "session">(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // If email confirmation is OFF, a session is returned immediately -> go onboard.
    if (data.session) {
      setDone("session");
      router.push("/onboarding");
      router.refresh();
      return;
    }
    setDone("confirm");
  }

  return (
    <div className="authwrap">
      <div className="card authcard">
        <div className="brand">
          <div className="logo">
            <FreshLeadsMark size={22} />
          </div>
          <h1>Fresh Leads</h1>
        </div>
        <h2>Create your account</h2>
        <p className="sub">Define your ideal lead. We deliver verified ones.</p>

        {done === "confirm" ? (
          <div className="authmsg ok">
            Check your inbox to confirm <b>{email}</b>, then sign in.
          </div>
        ) : (
          <form className="authform" onSubmit={onSubmit}>
            <div>
              <label htmlFor="name">Full name</label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <div className="authmsg err">{error}</div>}
            <button className="go" type="submit" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        )}

        <p className="authalt">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
