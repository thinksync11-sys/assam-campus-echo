import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ComplaintPhoto } from "@/components/ComplaintPhoto";
import { CATEGORIES } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Think Sync" },
      { name: "description", content: "Review campus complaints and respond to students, employees and stakeholders." },
      { property: "og:title", content: "Admin Dashboard — Think Sync" },
      { property: "og:description", content: "Review and respond to campus complaints." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

type Complaint = {
  id: string;
  tracking_code: string;
  name: string | null;
  email: string | null;
  role: string;
  categories: string[] | null;
  subcategory: string | null;
  description: string;
  location: string | null;
  status: string;
  admin_response: string | null;
  photo_url: string | null;
  created_at: string;
};

const STATUSES = [
  { id: "submitted", label: "Submitted" },
  { id: "in_review", label: "In review" },
  { id: "in_progress", label: "In progress" },
  { id: "resolved", label: "Resolved" },
  { id: "rejected", label: "Closed" },
];

const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.en ?? id;

function Admin() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Complaint[] | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) { setIsAdmin(false); return; }
      const { data: ok } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      setIsAdmin(!!ok);
      if (ok) {
        const { data } = await supabase
          .from("complaints")
          .select("id, tracking_code, name, email, role, categories, subcategory, description, location, status, admin_response, photo_url, created_at")
          .order("created_at", { ascending: false });
        setRows((data as Complaint[] | null) ?? []);
      }
    })();
  }, []);

  async function save(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const status = String(f.get("status"));
    const admin_response = String(f.get("admin_response") || "");
    setSaving(id);
    setSaveErr(null);
    const { error } = await supabase.from("complaints").update({ status, admin_response }).eq("id", id);
    setSaving(null);
    if (error) { setSaveErr("Could not save. Please try again."); return; }
    setRows((r) => r?.map((c) => (c.id === id ? { ...c, status, admin_response } : c)) ?? null);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isAdmin === null) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-4xl">Not an admin</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This account does not have admin access. Sign in with the Think Sync team Google account.
          </p>
          <button onClick={signOut} className="mt-6 rounded-full border border-border px-6 py-2.5 text-sm font-semibold transition-colors hover:border-primary">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-5 py-10">
      <header className="flex items-center justify-between">
        <Link to="/" className="font-display text-2xl italic">
          Think<span className="text-gradient">Sync</span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">{rows?.length ?? 0} complaints</span>
          <button onClick={signOut} className="rounded-full border border-border px-4 py-1.5 font-semibold transition-colors hover:border-primary">
            Sign out
          </button>
        </div>
      </header>
      <h1 className="mt-8 font-display text-4xl md:text-5xl">
        Complaint <em className="text-gradient">inbox</em>
      </h1>
      {saveErr && <p className="mt-4 text-sm text-destructive">{saveErr}</p>}
      <div className="mt-8 space-y-5">
        {rows?.length === 0 && <p className="italic text-muted-foreground">No complaints yet.</p>}
        {rows?.map((c) => (
          <article key={c.id} className="rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-mono text-sm text-primary-glow">#{c.tracking_code}</p>
              <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
            </div>
            <h2 className="mt-1 text-lg font-semibold">{c.categories?.map(catLabel).join(" · ")}</h2>
            <p className="text-sm italic text-muted-foreground">
              {c.subcategory}
              {c.location ? ` · ${c.location}` : ""}
            </p>
            <p className="mt-3 text-sm">{c.description}</p>
            {c.photo_url && <ComplaintPhoto path={c.photo_url} className="mt-3 max-h-64 rounded-xl border border-border object-cover" />}
            <p className="mt-3 text-xs text-muted-foreground">
              {c.name ?? "Anonymous"} · {c.role}
              {c.email ? ` · ${c.email}` : ""}
            </p>
            <form onSubmit={(e) => save(e, c.id)} className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-[200px_1fr_auto]">
              <select name="status" defaultValue={c.status} className="field">
                {STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <textarea
                name="admin_response"
                rows={2}
                maxLength={2000}
                defaultValue={c.admin_response ?? ""}
                placeholder="Write a response the reporter will see…"
                className="field"
              />
              <button
                disabled={saving === c.id}
                className="self-end rounded-full bg-gradient-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02] disabled:opacity-60"
              >
                {saving === c.id ? "Saving…" : "Save"}
              </button>
            </form>
          </article>
        ))}
      </div>
    </div>
  );
}
