import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ComplaintPhoto } from "@/components/ComplaintPhoto";
import { CATEGORIES, T, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Think Sync — Report & Track Campus Issues" },
      { name: "description", content: "A bilingual (Assamese / English) grievance platform for students, employees and university stakeholders." },
      { property: "og:title", content: "Think Sync — Report & Track Campus Issues" },
      { property: "og:description", content: "Report and track campus problems in Assamese or English." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Tracked = { tracking_code: string; categories: string[] | null; subcategory: string | null; status: string; admin_response: string | null; photo_url: string | null; created_at: string; updated_at: string };

function Index() {
  const [lang, setLang] = useState<Lang>("en");
  const t = T[lang];
  const [stats, setStats] = useState<Record<string, number>>({});
  const [cats, setCats] = useState<string[]>([CATEGORIES[0].id]);
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [found, setFound] = useState<Tracked | null | undefined>(undefined);

  const loadStats = async () => {
    const { data } = await supabase.rpc("complaint_stats");
    if (data) setStats(Object.fromEntries(data.map((r) => [r.category, Number(r.total)])));
  };
  useEffect(() => { loadStats(); }, []);

  const current = CATEGORIES.find((c) => c.id === cats[0]) ?? CATEGORIES[0];
  const subs = [...new Set(cats.flatMap((id) => CATEGORIES.find((c) => c.id === id)?.subs[lang] ?? []))];
  const toggleCat = (id: string) =>
    setCats((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.[lang] ?? id;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSending(true); setErr(null); setCode(null);
    if (!cats.length) {
      setSending(false);
      setErr(lang === "en" ? "Please pick at least one category." : "অনুগ্ৰহ কৰি অন্ততঃ এটা শ্ৰেণী বাছক।");
      return;
    }
    let photoPath: string | null = null;
    if (photo) {
      const ext = (photo.name.split(".").pop() || "jpg").toLowerCase();
      photoPath = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("complaint-photos").upload(photoPath, photo);
      if (upErr) {
        setSending(false);
        setErr(lang === "en" ? "Could not upload the photo. Please try a smaller image." : "ফটো আপল'ড কৰিব পৰা নগ'ল। সৰু ছবি চেষ্টা কৰক।");
        return;
      }
    }
    const { data, error } = await supabase.rpc("submit_complaint", {
      p_name: String(f.get("name") || ""), p_email: String(f.get("email") || ""),
      p_role: String(f.get("role")), p_categories: cats, p_subcategory: String(f.get("sub")),
      p_description: String(f.get("desc")),
      p_location: String(f.get("location") || ""), p_language: lang,
      p_photo_url: photoPath ?? undefined,
    });
    setSending(false);
    if (error) { setErr(lang === "en" ? "Please add your name and a description (10+ chars)." : "আপোনাৰ নাম আৰু বৰ্ণনা (১০+ আখৰ) দিয়ক।"); return; }
    setCode(data as string);
    setPhoto(null);
    (e.target as HTMLFormElement).reset();
    loadStats();
  }

  async function track(e: FormEvent) {
    e.preventDefault();
    const { data } = await supabase.rpc("track_complaint", { p_code: q });
    setFound(data && data.length ? (data[0] as Tracked) : null);
  }

  const steps = ["submitted", "in_review", "in_progress", "resolved"];

  return (
    <div className="min-h-screen overflow-x-hidden" style={lang === "as" ? { fontFamily: "'Noto Sans Bengali', var(--font-sans)" } : undefined}>

      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <a href="#top" className="font-display text-2xl italic">Think<span className="text-gradient">Sync</span></a>
          <nav className="hidden gap-8 text-sm text-muted-foreground md:flex">
            {["categories", "report", "track", "about"].map((id, i) => (
              <a key={id} href={`#${id}`} className="transition-colors hover:text-foreground hover:link-underline">{t.nav[i]}</a>
            ))}
            <Link to="/admin" className="transition-colors hover:text-foreground hover:link-underline">{t.admin}</Link>
          </nav>
          <div className="flex rounded-full border border-border p-1 text-xs">
            {(["en", "as"] as Lang[]).map((l) => (
              <button key={l} onClick={() => setLang(l)}
                className={`rounded-full px-3 py-1 transition-all ${lang === l ? "bg-gradient-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {l === "en" ? "EN" : "অস"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section id="top" className="relative bg-gradient-hero">
        <div className="pointer-events-none absolute -right-20 top-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl animate-float" />
        <div className="mx-auto max-w-6xl px-5 pb-24 pt-20 md:pt-32">
          <p className="animate-rise text-xs uppercase tracking-[0.3em] text-primary-glow">Grievance & campus issue platform</p>
          <h1 className="animate-rise mt-6 font-display text-6xl leading-[0.95] md:text-8xl" style={{ animationDelay: ".1s" }}>
            {t.heroA}<br /><em className="text-gradient">{t.heroB}</em>
          </h1>
          <p className="animate-rise mt-8 max-w-xl text-lg italic text-muted-foreground" style={{ animationDelay: ".2s" }}>{t.heroSub}</p>
          <div className="animate-rise mt-10 flex flex-wrap gap-4" style={{ animationDelay: ".3s" }}>
            <a href="#report" className="rounded-full bg-gradient-primary px-7 py-3.5 font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-105">{t.report} →</a>
            <a href="#track" className="rounded-full border border-border px-7 py-3.5 font-semibold underline-offset-4 transition-colors hover:border-primary hover:underline">{t.track}</a>
          </div>
        </div>
      </section>

      <section id="categories" className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="font-display text-4xl md:text-6xl">{t.catTitle} <em className="text-gradient">{t.catTitleB}</em></h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c, i) => (
            <button key={c.id} onClick={() => { toggleCat(c.id); document.getElementById("report")?.scrollIntoView(); }}
              className={`group animate-rise rounded-2xl border bg-card p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-glow ${cats.includes(c.id) ? "border-primary shadow-glow" : "border-border"}`}
              style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="flex items-start justify-between">
                <span className="text-3xl">{c.icon}</span>
                <span className="text-xs text-muted-foreground">{stats[c.id] ?? 0} {t.reported}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold group-hover:link-underline">{c[lang]}</h3>
              <ul className="mt-3 space-y-1 text-sm italic text-muted-foreground">
                {c.subs[lang].map((s) => <li key={s}>— {s}</li>)}
              </ul>
            </button>
          ))}
        </div>
      </section>

      <section id="report" className="border-y border-border bg-card/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="font-display text-4xl md:text-6xl">{t.formTitle} <em className="text-gradient">{t.formTitleB}</em></h2>
            <p className="mt-4 text-5xl">{current.icon}</p>
            <p className="mt-2 italic text-muted-foreground underline decoration-primary underline-offset-4">{current[lang]}</p>
          </div>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <input name="name" required minLength={1} placeholder={t.name} maxLength={100} className="field" />
            <input name="email" type="email" placeholder={t.email} maxLength={255} className="field" />
            <label className="text-sm text-muted-foreground">{t.role}
              <select name="role" className="field mt-1">
                {Object.entries(t.roles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <div className="text-sm text-muted-foreground sm:col-span-2">{t.category}
              <div className="mt-2 flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button type="button" key={c.id} onClick={() => toggleCat(c.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-all ${cats.includes(c.id) ? "border-primary bg-accent text-foreground" : "border-border text-muted-foreground hover:border-primary"}`}>
                    {c.icon} {c[lang]}
                  </button>
                ))}
              </div>
            </div>
            <label className="text-sm text-muted-foreground sm:col-span-2">{t.sub}
              <select name="sub" className="field mt-1">
                {subs.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <textarea name="desc" required minLength={10} maxLength={5000} rows={5} placeholder={t.desc} className="field sm:col-span-2" />
            <input name="location" maxLength={200} placeholder={t.location} className="field sm:col-span-2" />
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary sm:col-span-2">
              <span className="text-xl">📷</span>
              <span>{photo ? `${photo.name} — ${t.photoAttached}` : t.photo}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              />
            </label>
            <button disabled={sending} className="rounded-full bg-gradient-primary px-7 py-3.5 font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02] disabled:opacity-60 sm:col-span-2">
              {sending ? t.sending : t.submit}
            </button>
            {err && <p className="text-sm text-destructive sm:col-span-2">{err}</p>}
            {code && (
              <div className="animate-rise rounded-2xl border border-primary bg-accent p-5 sm:col-span-2">
                <p className="text-sm">{t.success}</p>
                <p className="mt-2 font-mono text-3xl tracking-widest text-gradient">{code}</p>
              </div>
            )}
          </form>
        </div>
      </section>

      <section id="track" className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h2 className="font-display text-4xl md:text-6xl">{t.trackTitle} <em className="text-gradient">{t.trackTitleB}</em></h2>
        <form onSubmit={track} className="mx-auto mt-8 flex max-w-md gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} required placeholder={t.code} className="field font-mono uppercase" />
          <button className="rounded-full bg-gradient-primary px-6 font-semibold text-primary-foreground">{t.find}</button>
        </form>
        {found === null && <p className="mt-6 italic text-muted-foreground">{t.notFound}</p>}
        {found && (
          <div className="animate-rise mt-8 rounded-2xl border border-border bg-card p-6 text-left">
            <p className="font-mono text-sm text-primary-glow">#{found.tracking_code}</p>
            <h3 className="mt-1 text-xl font-semibold">{found.categories?.map(catLabel).join(" · ")}</h3>
            <p className="text-sm italic text-muted-foreground">{found.subcategory}</p>
            {found.photo_url && <ComplaintPhoto path={found.photo_url} className="mt-4 max-h-64 w-full rounded-xl border border-border object-cover" />}
            <div className="mt-6 grid grid-cols-4 gap-2">
              {steps.map((s, i) => {
                const active = steps.indexOf(found.status) >= i;
                return (
                  <div key={s}>
                    <div className={`h-1.5 rounded-full transition-all ${active ? "bg-gradient-primary" : "bg-muted"}`} />
                    <p className={`mt-2 text-xs ${active ? "text-foreground" : "text-muted-foreground"}`}>{t.status[s as keyof typeof t.status]}</p>
                  </div>
                );
              })}
            </div>
            {found.admin_response && (
              <div className="mt-4 rounded-xl border border-primary/40 bg-accent p-4">
                <p className="text-xs uppercase tracking-widest text-primary-glow">{t.adminResponse}</p>
                <p className="mt-1 text-sm">{found.admin_response}</p>
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">{new Date(found.created_at).toLocaleString()}</p>
          </div>
        )}
      </section>

      <section id="about" className="border-t border-border bg-gradient-hero">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary-glow">{t.team}</p>
            <h2 className="mt-4 font-display text-5xl md:text-7xl">{t.aboutTitle} <em className="text-gradient">Think Sync</em></h2>
            <p className="mt-6 max-w-md italic text-muted-foreground">{t.aboutBody}</p>
          </div>
          <div className="self-end rounded-2xl border border-border bg-card p-8">
            <p className="text-sm text-muted-foreground">{t.contact}</p>
            <a href="mailto:thinksync11@gmail.com" className="mt-2 block break-all font-display text-3xl italic link-underline transition-colors hover:text-primary-glow">
              thinksync11@gmail.com
            </a>
          </div>
        </div>
        <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} <em>Think Sync</em> · thinksync11@gmail.com
        </footer>
      </section>
    </div>
  );
}
