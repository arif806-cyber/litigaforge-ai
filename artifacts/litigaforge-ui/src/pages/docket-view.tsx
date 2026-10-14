import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ExternalLink, Loader2, Save, Search, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

type Court = { state: string; district_code: string; complex_code: string; court: string; court_no: string };
type Profile = { cause_list_name: string; enrolment_number: string; court_ids: string[] };
type Matter = Record<string, unknown>;
type DayResults = { date: string; status: "ok" | "no_sitting" | "not_loaded" | "unavailable"; matters: Matter[]; fetched_at?: string; source_url?: string; message?: string };
type CourtResults = { court: Court; today: DayResults; tomorrow: DayResults };
type ListingResponse = { courts: CourtResults[]; source_url: string };
type Item = Record<string, string>;

const sourceUrl = "https://services.ecourts.gov.in/ecourtindia_v6/?p=cause_list/index";
const rows = (data: unknown): Item[] => {
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  const inner = obj.data && typeof obj.data === "object" ? obj.data as Record<string, unknown> : obj;
  const list = inner.items ?? inner.states ?? inner.districts ?? inner.complexes ?? inner.courts ?? inner.results;
  return Array.isArray(list) ? list.filter((v): v is Item => !!v && typeof v === "object") : [];
};
const encodeCourt = (court: Court) => JSON.stringify({
  state: court.state, district_code: court.district_code, complex_code: court.complex_code,
  court: court.court, court_no: court.court_no,
});
const courtName = (court: Court) => `${court.court} ${court.court_no} · ${court.complex_code} · ${court.district_code} · ${court.state}`;
const field = (item: Matter, ...keys: string[]) => {
  for (const key of keys) {
    const value = item[key];
    if (Array.isArray(value)) return value.join(", ");
    if (value !== null && value !== undefined && String(value).trim()) return String(value);
  }
  return "";
};

export default function DocketView() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [profile, setProfile] = useState<Profile>({ cause_list_name: "", enrolment_number: "", court_ids: [] });
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [complex, setComplex] = useState("");
  const [courtLookupEnabled, setCourtLookupEnabled] = useState(false);
  const [courtPickerOpen, setCourtPickerOpen] = useState(false);
  const [courtSearch, setCourtSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "mine">("all");
  const [listing, setListing] = useState<ListingResponse | null>(null);
  const advocate = user?.role === "advocate" || user?.role === "lawyer";
  const profileQuery = useQuery({
    queryKey: ["docket-profile", user?.id],
    queryFn: () => apiFetch("/docket/profile") as Promise<{ profile: Profile | null; advocate_profile?: { name?: string; bar_number?: string } | null }>,
    enabled: !!advocate,
  });
  const cachedQuery = useQuery({
    queryKey: ["docket-schedule", user?.id],
    queryFn: () => apiFetch("/docket/schedule") as Promise<ListingResponse>,
    enabled: !!advocate,
  });
  const hierarchy = (path: string, enabled: boolean) => ({
    queryKey: ["docket-court-structure", path],
    queryFn: () => apiFetch(`/docket/courts?path=${encodeURIComponent(path)}`).then(rows),
    enabled: !!advocate && enabled,
    staleTime: 60 * 60 * 1000,
  });
  const states = useQuery(hierarchy("states", courtLookupEnabled));
  const districts = useQuery(hierarchy(`states/${state}/districts`, courtLookupEnabled && !!state));
  const complexes = useQuery(hierarchy(`states/${state}/districts/${district}/complexes`, courtLookupEnabled && !!state && !!district));
  const courtsQuery = useQuery(hierarchy(`states/${state}/districts/${district}/complexes/${complex}/courts`, courtLookupEnabled && !!state && !!district && !!complex));

  useEffect(() => {
    const saved = profileQuery.data?.profile;
    if (!profileQuery.data) return;
    const lawyer = profileQuery.data.advocate_profile;
    const courtIds = saved?.court_ids ?? [];
    setProfile({
      cause_list_name: saved?.cause_list_name || lawyer?.name || user?.name || "",
      enrolment_number: saved?.enrolment_number || lawyer?.bar_number || "",
      court_ids: courtIds,
    });
    try {
      const first = JSON.parse(courtIds[0] ?? "") as Court;
      setState(first.state || "");
      setDistrict(first.district_code || "");
      setComplex(first.complex_code || "");
    } catch { /* no saved court */ }
  }, [profileQuery.data, user?.name]);
  useEffect(() => { if (cachedQuery.data) setListing(cachedQuery.data); }, [cachedQuery.data]);

  const load = useMutation({
    mutationFn: (courtIds: string[]) => apiFetch("/docket/load", { method: "POST", body: JSON.stringify({ court_ids: courtIds }) }) as Promise<ListingResponse>,
    onSuccess: (data) => { setListing(data); void client.invalidateQueries({ queryKey: ["docket-schedule", user?.id] }); },
  });
  const save = useMutation({
    mutationFn: () => apiFetch("/docket/profile", { method: "PUT", body: JSON.stringify(profile) }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["docket-profile", user?.id] });
      load.mutate(profile.court_ids);
    },
  });
  const track = useMutation({
    mutationFn: (cnr: string) => apiFetch("/docket/onboarding/import", { method: "POST", body: JSON.stringify({ cnrs: [cnr] }) }),
  });

  const availableCourts = (courtsQuery.data ?? []).map((item) => ({
    state, district_code: district, complex_code: complex,
    court: item.court ?? item.courtName ?? "",
    court_no: item.courtNo ?? item.court_no ?? "",
    label: `${item.judgeName ?? item.judge_name ?? item.courtName ?? item.court ?? "Court"} · ${item.courtNo ?? item.court_no ?? ""}`,
  }));
  const visibleCourts = availableCourts.filter((court) => `${court.label} ${court.court} ${court.court_no}`.toLowerCase().includes(courtSearch.toLowerCase()));
  const selected = useMemo(() => profile.court_ids.flatMap((value) => { try { return [JSON.parse(value) as Court]; } catch { return []; } }), [profile.court_ids]);
  const changeCourt = (court: Court) => {
    const value = encodeCourt(court);
    setProfile((p) => ({ ...p, court_ids: p.court_ids.includes(value) ? p.court_ids.filter((v) => v !== value) : [...p.court_ids, value] }));
  };
  const submit = (event: FormEvent) => { event.preventDefault(); save.mutate(); };
  const isMine = (matter: Matter) => {
    const terms = [profile.cause_list_name, profile.enrolment_number].map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (!terms.length) return true;
    const text = Object.values(matter).flatMap((v) => Array.isArray(v) ? v : [v]).join(" ").toLowerCase();
    return terms.some((term) => text.includes(term));
  };
  const matching = (items: Matter[]) => filter === "mine" ? items.filter(isMine) : items;
  const selectedResults = selected.map((court) => listing?.courts.find((entry) => encodeCourt(entry.court) === encodeCourt(court))).filter((v): v is CourtResults => !!v);

  if (!advocate) return <main className="mx-auto max-w-3xl p-6"><h1 className="text-2xl font-semibold">DocketView</h1><p className="mt-3 text-muted-foreground">Available to advocates.</p></main>;
  return <main className="mx-auto w-full max-w-5xl space-y-5 p-4 pb-24 md:p-8" data-testid="docket-view">
    <header className="flex items-start gap-3"><CalendarDays className="mt-1 h-6 w-6 text-primary" /><div><h1 className="text-2xl font-bold">DocketView</h1><p className="text-sm text-muted-foreground">Browse today’s and tomorrow’s cause lists by court.</p></div></header>
    <section className="rounded-xl border bg-card p-4 md:p-6">
      <h2 className="mb-4 font-semibold">Your courts and optional matching details</h2>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm">Name as it appears in cause lists <span className="text-muted-foreground">(optional)</span><input className="mt-1 w-full rounded-md border bg-background p-2" value={profile.cause_list_name} onChange={(e) => setProfile({ ...profile, cause_list_name: e.target.value })} /></label>
        <label className="block text-sm">Enrolment number <span className="text-muted-foreground">(optional)</span><input className="mt-1 w-full rounded-md border bg-background p-2" value={profile.enrolment_number} onChange={(e) => setProfile({ ...profile, enrolment_number: e.target.value })} /></label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">State<select className="mt-1 w-full rounded border bg-background p-2" value={state} onFocus={() => setCourtLookupEnabled(true)} onChange={(e) => { setState(e.target.value); setDistrict(""); setComplex(""); }}><option value="">Select state</option>{states.data?.map((x) => <option key={x.state} value={x.state}>{x.stateName}</option>)}</select></label>
          <label className="text-sm">District<select className="mt-1 w-full rounded border bg-background p-2" value={district} disabled={!state} onChange={(e) => { setDistrict(e.target.value); setComplex(""); }}><option value="">Select district</option>{districts.data?.map((x) => <option key={x.districtCode} value={x.districtCode}>{x.districtName}</option>)}</select></label>
          <label className="text-sm">Court complex<select className="mt-1 w-full rounded border bg-background p-2" value={complex} disabled={!district} onChange={(e) => setComplex(e.target.value)}><option value="">Select complex</option>{complexes.data?.map((x) => <option key={x.courtComplexCode} value={x.courtComplexCode}>{x.courtComplexName}</option>)}</select></label>
        </div>
        <Button type="button" variant="outline" onClick={() => { setCourtLookupEnabled(true); setCourtPickerOpen(true); setCourtSearch(""); }} disabled={!complex}>Choose courts ({profile.court_ids.length} selected)</Button>
        {profile.court_ids.length > 10 && <p role="alert" className="text-sm text-destructive">Choose at most 10 courts per load.</p>}
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={save.isPending || !profile.court_ids.length || profile.court_ids.length > 10}><Save className="mr-2 h-4 w-4" />{save.isPending ? "Saving…" : "Save profile"}</Button><Button type="button" variant="outline" disabled={!profile.court_ids.length || load.isPending} onClick={() => load.mutate(profile.court_ids)}>{load.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Load cause list</Button></div>
        {save.isError && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}{load.isError && <p role="alert" className="text-sm text-destructive">{load.error.message}</p>}
      </form>
    </section>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Cause lists</h2><div className="flex gap-2"><Button type="button" size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All matters</Button><Button type="button" size="sm" variant={filter === "mine" ? "default" : "outline"} onClick={() => setFilter("mine")}>My matters</Button></div></div>
    {!profile.cause_list_name.trim() && !profile.enrolment_number.trim() && <p className="text-xs text-muted-foreground">Add your name as it appears in cause lists to highlight your matters.</p>}
    {selectedResults.length === 0 && <p className="rounded-lg border p-4 text-sm text-muted-foreground">{selected.length ? "Select Load cause list to fetch these courts." : "Choose one or more courts to browse their cause lists."}</p>}
    {selectedResults.map((entry) => <section key={encodeCourt(entry.court)} className="rounded-xl border bg-card p-4 md:p-6"><h3 className="font-semibold">{courtName(entry.court)}</h3>{(["today", "tomorrow"] as const).map((period) => {
      const day = entry[period]; const matters = matching(day.matters).sort((a, b) => Number(field(a, "itemNo", "item_no", "serialNo", "serial_no", "item_number") || 0) - Number(field(b, "itemNo", "item_no", "serialNo", "serial_no", "item_number") || 0));
      return <div key={period} className="mt-4"><h4 className="text-sm font-medium">{period === "today" ? "Today" : "Tomorrow"} · {day.date}</h4>
        {day.status === "not_loaded" && <p className="mt-2 text-sm text-muted-foreground">Select “Load cause list” to check this court.</p>}
        {day.status === "no_sitting" && <p className="mt-2 text-sm text-muted-foreground">No sitting {period === "today" ? "today" : "tomorrow"}.</p>}
        {day.status === "unavailable" && <p role="alert" className="mt-2 text-sm text-destructive">Source unavailable — try again later.</p>}
        {day.status === "ok" && matters.length === 0 && filter === "mine" && <p className="mt-2 text-sm text-muted-foreground">No matching matters for your profile.</p>}
        {matters.map((matter, index) => { const cnr = field(matter, "cnr", "CNR"); const petitioner = field(matter, "petitioner_name", "petitioner", "petitioners"); const respondent = field(matter, "respondent_name", "respondent", "respondents"); const title = [petitioner, respondent].filter(Boolean).join(" vs ") || field(matter, "caseNo", "case_no", "caseNumber", "case_number") || "Court matter"; return <article key={`${cnr}-${index}`} className="mt-2 rounded-lg border bg-background p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{title}</strong><span className="text-muted-foreground">Item {field(matter, "itemNo", "item_no", "serialNo", "serial_no", "item_number") || index + 1}</span></div><p className="mt-1">{field(matter, "caseNo", "case_no", "caseNumber", "case_number")}</p><p className="text-xs text-muted-foreground">{field(matter, "stage", "purpose", "business", "hearing_purpose")}</p><div className="mt-2 flex flex-wrap gap-3 text-xs">{cnr && <a className="underline" href={`/cnr-tracker?cnr=${encodeURIComponent(cnr)}`}>CNR {cnr}</a>}{cnr && <button type="button" className="underline" disabled={track.isPending} onClick={() => track.mutate(cnr)}>Track this case</button>}</div></article>; })}
        {day.fetched_at && <p className="mt-2 text-xs text-muted-foreground">Updated {new Date(day.fetched_at).toLocaleString()} · <a className="underline" href={day.source_url ?? sourceUrl} target="_blank" rel="noreferrer">eCourtsIndia source</a></p>}
      </div>;
    })}</section>)}
    <a className="inline-flex items-center gap-1 text-sm text-primary underline" href={sourceUrl} target="_blank" rel="noreferrer">Open official eCourts cause list <ExternalLink className="h-3 w-3" /></a>
    {courtPickerOpen && createPortal(<div className="fixed inset-0 z-[9999] flex items-end bg-black/50 p-0 sm:items-center sm:justify-center sm:p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setCourtPickerOpen(false); }}><section role="dialog" aria-modal="true" aria-label="Choose courts" className="w-full rounded-t-2xl border bg-background p-4 shadow-xl sm:max-w-xl sm:rounded-xl"><div className="flex items-center justify-between"><h2 className="font-semibold">Choose courts ({profile.court_ids.length} selected)</h2><Button type="button" size="icon" variant="ghost" aria-label="Close court list" onClick={() => setCourtPickerOpen(false)}><X className="h-4 w-4" /></Button></div><div className="my-3 flex gap-2"><label className="flex min-w-0 flex-1 items-center gap-2 rounded border px-2"><Search className="h-4 w-4" /><input aria-label="Search courts by judge or court number" className="min-w-0 flex-1 bg-transparent p-2 text-sm outline-none" placeholder="Judge name or court number" value={courtSearch} onChange={(e) => setCourtSearch(e.target.value)} /></label><Button type="button" size="sm" variant="outline" onClick={() => { const additions = visibleCourts.map(encodeCourt).filter((id) => !profile.court_ids.includes(id)).slice(0, Math.max(0, 10 - profile.court_ids.length)); setProfile((p) => ({ ...p, court_ids: [...p.court_ids, ...additions] })); }}>Select all (max 10)</Button><Button type="button" size="sm" variant="outline" onClick={() => setProfile((p) => ({ ...p, court_ids: [] }))}>Clear</Button></div><div className="max-h-[55vh] space-y-2 overflow-y-auto">{courtsQuery.isLoading && <p className="text-sm">Loading courts…</p>}{visibleCourts.map((court) => <label key={encodeCourt(court)} className="flex items-center gap-3 rounded border p-3 text-sm"><input type="checkbox" checked={profile.court_ids.includes(encodeCourt(court))} onChange={() => changeCourt(court)} />{court.label}</label>)}{!courtsQuery.isLoading && visibleCourts.length === 0 && <p className="text-sm text-muted-foreground">No matching courts.</p>}</div><Button className="mt-3 w-full" onClick={() => setCourtPickerOpen(false)}>Done · {profile.court_ids.length} selected</Button></section></div>, document.body)}
  </main>;
}
