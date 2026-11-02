import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Team Sign In — Think Sync" },
      { name: "description", content: "Sign in for the Think Sync team to review and respond to campus complaints." },
      { property: "og:title", content: "Team Sign In — Think Sync" },
      { property: "og:description", content: "Admin sign-in for the Think Sync campus grievance platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Auth,
});

function Auth() {
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/admin" });
    });
  }, [navigate]);

  async function signIn() {
    setBusy(true);
    setErr(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth`,
    });
    if (result.error) {
      setErr("Sign-in failed. Please try again.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/admin" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-5">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center">
        <Link to="/" className="font-display text-2xl italic">
          Think<span className="text-gradient">Sync</span>
        </Link>
        <h1 className="mt-6 font-display text-3xl">Team sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          For the Think Sync team to review and answer campus complaints.
        </p>
        <button
          onClick={signIn}
          disabled={busy}
          className="mt-8 w-full rounded-full bg-gradient-primary px-6 py-3.5 font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02] disabled:opacity-60"
        >
          {busy ? "Opening Google…" : "Continue with Google"}
        </button>
        {err && <p className="mt-4 text-sm text-destructive">{err}</p>}
      </div>
    </div>
  );
}
