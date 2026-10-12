import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ExternalLink, Save } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

const COURTS = [
  ["telangana_high_court", "Telangana High Court"],
  ["hyderabad_district", "Hyderabad District Courts"],
  ["rangareddy_district", "Ranga Reddy District Courts"],
] as const;
type Profile = { cause_list_name: string; enrolment_number: string; court_ids: string[] };
type Schedule = {
  today: { date: string; matters: Record<string, unknown>[]; published?: boolean };
  tomorrow: { date: string; matters: Record<string, unknown>[]; published?: boolean };
  source_url: string;
  fetched_at: string | null;
  source_status: string;
  message: string;
};

export default function DocketView() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<Profile>({ cause_list_name: "", enrolment_number: "", court_ids: ["telangana_high_court"] });
  const [selectedCases, setSelectedCases] = useState<string[]>([]);
  const [nameMatchMode, setNameMatchMode] = useState<"phrase" | "fuzzy">("phrase");
  const [suggestionError, setSuggestionError] = useState("");
  const isAdvocate = user?.role === "advocate" || user?.role === "lawyer";
  const profileQuery = useQuery({
    queryKey: ["docket-profile", user?.id],
    queryFn: () => apiFetch("/docket/profile").then((value) => value as { profile: Profile | null }),
    enabled: !!isAdvocate,
  });
  const scheduleQuery = useQuery({
    queryKey: ["docket-schedule", user?.id],
    queryFn: () => apiFetch("/docket/schedule").then((value) => value as Schedule),
    enabled: !!isAdvocate,
    refetchInterval: 60_000,
  });
  useEffect(() => {
    if (profileQuery.data?.profile) setProfile(profileQuery.data.profile);
  }, [profileQuery.data]);
  const save = useMutation({
    mutationFn: () => apiFetch("/docket/profile", { method: "PUT", body: JSON.stringify(profile) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["docket-profile", user?.id] });
      if (!profileQuery.data?.profile) suggestions.mutate();
    },
  });
  const suggestions = useMutation<{ total: number; suggestions: Record<string, unknown>[] }, Error>({
    mutationFn: () => apiFetch("/docket/onboarding/suggestions", {
      method: "POST",
      body: JSON.stringify({
        name_variants: [profile.cause_list_name, profile.cause_list_name.toUpperCase()],
        court_codes: profile.court_ids,
        name_match_mode: nameMatchMode,
      }),
    }).then((value) => value as { total: number; suggestions: Record<string, unknown>[] }),
    onError: (error) => setSuggestionError(error.message),
    onSuccess: () => setSuggestionError(""),
  });
  const importCases = useMutation({
    mutationFn: () => apiFetch("/docket/onboarding/import", {
      method: "POST",
      body: JSON.stringify({ cnrs: selectedCases }),
    }),
    onSuccess: () => {
      setSelectedCases([]);
      void suggestions.reset();
    },
  });
  const toggleCourt = (id: string) => setProfile((p) => ({
    ...p, court_ids: p.court_ids.includes(id) ? p.court_ids.filter((x) => x !== id) : [...p.court_ids, id],
  }));
  const submit = (event: FormEvent) => { event.preventDefault(); save.mutate(); };
  const matterTitle = (matter: Record<string, unknown>) => {
    const title = matter.title;
    if (typeof title === "string" && title.trim()) return title;
    const petitioner = matter.petitioner_name ?? matter.petitioner ?? matter.petitioners;
    const respondent = matter.respondent_name ?? matter.respondent ?? matter.respondents;
    const text = (value: unknown) => Array.isArray(value) ? value.join(", ") : String(value ?? "");
    return [text(petitioner), text(respondent)].filter(Boolean).join(" vs ") || String(matter.cnr ?? "Court listing");
  };

  if (!isAdvocate) return <main className="mx-auto max-w-3xl p-6"><h1 className="text-2xl font-semibold">DocketView</h1><p className="mt-3 text-muted-foreground">This daily cause list is available to advocates.</p></main>;
  const schedule = scheduleQuery.data;
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 pb-24 md:p-8" data-testid="docket-view">
      <header className="flex items-start gap-3">
        <CalendarDays className="mt-1 h-6 w-6 text-primary" />
        <div><h1 className="text-2xl font-bold">DocketView</h1><p className="text-sm text-muted-foreground">Your daily cause list and court source status.</p></div>
      </header>
      <section className="rounded-xl border border-border bg-card p-4 md:p-6">
        <h2 className="mb-4 font-semibold">Advocate cause-list profile</h2>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm">Name as it appears in cause lists<input required minLength={2} maxLength={160} className="mt-1 w-full rounded-md border border-input bg-background p-2" value={profile.cause_list_name} onChange={(e) => setProfile({ ...profile, cause_list_name: e.target.value })} /></label>
          <label className="block text-sm">Enrolment number<input required minLength={2} maxLength={80} className="mt-1 w-full rounded-md border border-input bg-background p-2" value={profile.enrolment_number} onChange={(e) => setProfile({ ...profile, enrolment_number: e.target.value })} /></label>
          <fieldset><legend className="mb-2 text-sm">Courts</legend><div className="grid gap-2 sm:grid-cols-3">{COURTS.map(([id, label]) => <label key={id} className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={profile.court_ids.includes(id)} onChange={() => toggleCourt(id)} />{label}</label>)}</div></fieldset>
          <Button type="submit" disabled={save.isPending || profile.court_ids.length === 0}><Save className="mr-2 h-4 w-4" />{save.isPending ? "Saving…" : "Save profile"}</Button>
          {save.isError && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}
        </form>
      </section>
      {suggestions.data && (
        <section className="rounded-xl border border-border bg-card p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">We found {suggestions.data.total} cases that may be yours</h2>
              <p className="text-sm text-muted-foreground">Nothing is imported until you select cases and confirm.</p>
            </div>
            <label className="text-sm">Name matching
              <select className="ml-2 rounded border border-input bg-background p-2" value={nameMatchMode} onChange={(e) => setNameMatchMode(e.target.value as "phrase" | "fuzzy")}>
                <option value="phrase">Phrase</option><option value="fuzzy">Fuzzy</option>
              </select>
            </label>
          </div>
          <div className="mt-4 max-h-80 space-y-2 overflow-auto">
            {suggestions.data.suggestions.map((caseItem, index) => {
              const cnr = String(caseItem.cnr ?? "");
              return <label key={`${cnr}-${index}`} className="flex gap-3 rounded-lg border border-border p-3 text-sm">
                <input type="checkbox" disabled={!cnr} checked={selectedCases.includes(cnr)} onChange={(event) => setSelectedCases((current) => event.target.checked ? [...current, cnr] : current.filter((item) => item !== cnr))} />
                <span><strong>{matterTitle(caseItem)}</strong><br /><span className="text-xs text-muted-foreground">{cnr} · {String(caseItem.court_name ?? "Court not listed")}</span></span>
              </label>;
            })}
            {suggestions.data.suggestions.length === 0 && <p className="text-sm text-muted-foreground">No matching cases were returned.</p>}
          </div>
          <Button className="mt-4" disabled={!selectedCases.length || importCases.isPending} onClick={() => importCases.mutate()}>
            {importCases.isPending ? "Importing…" : `Confirm import (${selectedCases.length})`}
          </Button>
          {suggestionError && <p role="alert" className="mt-2 text-sm text-destructive">{suggestionError}</p>}
          {importCases.isError && <p role="alert" className="mt-2 text-sm text-destructive">{importCases.error.message}</p>}
          {importCases.isSuccess && <p className="mt-2 text-sm text-emerald-700">Confirmed cases were added to your CNR tracker. They’ll be refreshed in the scheduled batch.</p>}
        </section>
      )}
      <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Today · {schedule?.today.date ?? "…"}</h2>
          <p className="text-xs text-muted-foreground">Tomorrow · {schedule?.tomorrow.date ?? "…"}</p>
        </div>
        {scheduleQuery.isLoading ? <p className="mt-4 text-sm">Checking court list status…</p> : (
          <div className="mt-4 space-y-3">
            <p className="text-sm">{schedule?.message ?? "Cause-list source status unavailable."}</p>
            <p className="text-xs text-muted-foreground">No fetch time yet{schedule?.fetched_at ? ` · last checked ${new Date(schedule.fetched_at).toLocaleString()}` : ""}. Lists appear only after a verified source is connected.</p>
            {(["today", "tomorrow"] as const).map((period) => {
              const list = schedule?.[period];
              return <div key={period} className="mt-3">
                <h3 className="text-sm font-semibold">{period === "today" ? "Today" : "Tomorrow"}’s matters</h3>
                {!list?.published && schedule?.source_status === "connected" ? <p className="text-sm text-muted-foreground">Not published yet.</p> : null}
                {list?.matters.map((matter, index) => <article key={`${String(matter.cnr ?? "matter")}-${index}`} className="mt-2 rounded-lg border border-border bg-background p-3 text-sm">
                  <strong>{matterTitle(matter)}</strong>
                  <p className="text-xs text-muted-foreground">{String(matter.cnr ?? "")} · {String(matter.courtName ?? matter.court_name ?? "")} · {String(matter.courtNo ?? matter.court_no ?? "")}</p>
                </article>)}
              </div>;
            })}
            {schedule?.source_url && <a className="inline-flex items-center gap-1 text-sm text-primary underline" href={schedule.source_url} target="_blank" rel="noreferrer">Open official eCourts cause list <ExternalLink className="h-3 w-3" /></a>}
            {scheduleQuery.isError && <p role="alert" className="text-sm text-destructive">Could not check cause-list status. Try again later.</p>}
          </div>
        )}
      </section>
    </main>
  );
}
