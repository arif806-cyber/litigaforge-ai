import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, Circle, ExternalLink, Save } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { getDocketViewState } from "./docket-state";

type Profile = { cause_list_name: string; enrolment_number: string; court_ids: string[] };
type ProfileResponse = {
  profile: Profile | null;
  advocate_profile?: { name?: string | null; bar_number?: string | null } | null;
  tracked_cases_count?: number;
};
type HierarchyItem = Record<string, string>;
const OFFICIAL_CAUSE_LIST_URL = "https://services.ecourts.gov.in/ecourtindia_v6/?p=cause_list/index";

function courtLabel(value: string): string {
  try {
    const court = JSON.parse(value) as Record<string, string>;
    return [
      court.court && court.court_no ? `${court.court} ${court.court_no}` : court.court,
      court.complex_code,
      court.district_code,
      court.state,
    ].filter(Boolean).join(" · ") || "Selected court";
  } catch {
    return value || "Selected court";
  }
}

const hierarchyItems = (value: unknown): HierarchyItem[] => {
  if (!value || typeof value !== "object") return [];
  const wrapper = value as { data?: unknown; items?: unknown; states?: unknown; districts?: unknown; complexes?: unknown; courts?: unknown; results?: unknown };
  const nested = wrapper.data && typeof wrapper.data === "object" ? wrapper.data as typeof wrapper : wrapper;
  const rows = nested.items ?? nested.states ?? nested.districts ?? nested.complexes ?? nested.courts ?? nested.results;
  return Array.isArray(rows) ? rows.filter((item): item is HierarchyItem => !!item && typeof item === "object") : [];
};
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
  const [, setLocation] = useLocation();
  const [profile, setProfile] = useState<Profile>({ cause_list_name: "", enrolment_number: "", court_ids: [] });
  const [stateCode, setStateCode] = useState("");
  const [districtCode, setDistrictCode] = useState("");
  const [complexCode, setComplexCode] = useState("");
  const [courtPickerEnabled, setCourtPickerEnabled] = useState(false);
  const [selectedCases, setSelectedCases] = useState<string[]>([]);
  const [nameMatchMode, setNameMatchMode] = useState<"phrase" | "fuzzy">("phrase");
  const [suggestionError, setSuggestionError] = useState("");
  const isAdvocate = user?.role === "advocate" || user?.role === "lawyer";
  const profileQuery = useQuery({
    queryKey: ["docket-profile", user?.id],
    queryFn: () => apiFetch("/docket/profile").then((value) => value as ProfileResponse),
    enabled: !!isAdvocate,
  });
  const scheduleQuery = useQuery({
    queryKey: ["docket-schedule", user?.id],
    queryFn: () => apiFetch("/docket/schedule").then((value) => value as Schedule),
    enabled: !!isAdvocate,
    refetchInterval: 60_000,
  });
  const courtStructure = (path: string, enabled = true) => ({
    queryKey: ["docket-court-structure", path],
    queryFn: () => apiFetch(`/docket/courts?path=${encodeURIComponent(path)}`).then(hierarchyItems),
    enabled: !!isAdvocate && enabled,
    staleTime: 60 * 60 * 1000,
  });
  const statesQuery = useQuery(courtStructure("states", courtPickerEnabled));
  const districtsQuery = useQuery(courtStructure(`states/${stateCode}/districts`, courtPickerEnabled && !!stateCode));
  const complexesQuery = useQuery(courtStructure(`states/${stateCode}/districts/${districtCode}/complexes`, courtPickerEnabled && !!stateCode && !!districtCode));
  const courtsQuery = useQuery(courtStructure(`states/${stateCode}/districts/${districtCode}/complexes/${complexCode}/courts`, courtPickerEnabled && !!stateCode && !!districtCode && !!complexCode));
  useEffect(() => {
    if (profileQuery.data) {
      const savedProfile = profileQuery.data.profile;
      const advocate = profileQuery.data.advocate_profile;
      setProfile({
        cause_list_name: savedProfile?.cause_list_name?.trim() || advocate?.name?.trim() || user?.name || "",
        enrolment_number: savedProfile?.enrolment_number?.trim() || advocate?.bar_number?.trim() || "",
        court_ids: savedProfile?.court_ids ?? [],
      });
      const saved = (savedProfile?.court_ids ?? []).map((value) => {
        try { return JSON.parse(value) as Record<string, string>; } catch { return null; }
      }).find((value) => value);
      if (saved) {
        setStateCode(saved.state ?? "");
        setDistrictCode(saved.district_code ?? "");
        setComplexCode(saved.complex_code ?? "");
      }
    }
  }, [profileQuery.data, user?.name]);
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
  const toggleCourt = (court: HierarchyItem) => {
    const value = JSON.stringify({
      state: stateCode, district_code: districtCode, complex_code: complexCode,
      court: court.court ?? "", court_no: court.courtNo ?? "",
    });
    setProfile((p) => ({
      ...p, court_ids: p.court_ids.includes(value) ? p.court_ids.filter((x) => x !== value) : [...p.court_ids, value],
    }));
  };
  const resetCourts = () => setProfile((p) => ({ ...p, court_ids: [] }));
  const submit = (event: FormEvent) => { event.preventDefault(); save.mutate(); };
  const focusFormField = (id: string) => {
    const container = document.getElementById(id);
    if (!container) return;
    container.scrollIntoView({ behavior: "smooth", block: "center" });
    const target = container.matches("input, select, button")
      ? container
      : container.querySelector<HTMLElement>("input, select, button");
    target?.focus({ preventScroll: true });
  };
  const firstIncompleteField = () => {
    if (!profile.cause_list_name.trim()) return "docket-name";
    if (!profile.enrolment_number.trim()) return "docket-enrolment";
    return "docket-courts";
  };
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
  const docketState = getDocketViewState(profileQuery.data?.profile ?? null, schedule ?? null);
  const watchedCourts = (profileQuery.data?.profile?.court_ids ?? []).map(courtLabel);
  const trackedCasesCount = profileQuery.data?.tracked_cases_count ?? 0;
  const lastUpdated = schedule?.fetched_at
    ? new Date(schedule.fetched_at).toLocaleString()
    : null;
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 pb-24 md:p-8" data-testid="docket-view">
      <header className="flex items-start gap-3">
        <CalendarDays className="mt-1 h-6 w-6 text-primary" />
        <div><h1 className="text-2xl font-bold">DocketView</h1><p className="text-sm text-muted-foreground">Your daily cause list and court source status.</p></div>
      </header>
      <section className="rounded-xl border border-border bg-card p-4 md:p-6">
        <h2 className="mb-4 font-semibold">Advocate cause-list profile</h2>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm">Name as it appears in cause lists<input id="docket-name" required minLength={2} maxLength={160} className="mt-1 w-full rounded-md border border-input bg-background p-2" value={profile.cause_list_name} onChange={(e) => setProfile({ ...profile, cause_list_name: e.target.value })} /></label>
          <label className="block text-sm">Enrolment number<input id="docket-enrolment" required minLength={2} maxLength={80} className="mt-1 w-full rounded-md border border-input bg-background p-2" value={profile.enrolment_number} onChange={(e) => setProfile({ ...profile, enrolment_number: e.target.value })} /></label>
          <fieldset id="docket-courts" onFocusCapture={() => setCourtPickerEnabled(true)} className="space-y-3">
            <legend className="mb-2 text-sm">Court locations</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">State<select className="mt-1 w-full rounded border border-input bg-background p-2" value={stateCode} onChange={(e) => { setStateCode(e.target.value); setDistrictCode(""); setComplexCode(""); resetCourts(); }}><option value="">Select state</option>{statesQuery.data?.map((item) => <option key={item.state} value={item.state}>{item.stateName}</option>)}</select></label>
              <label className="text-sm">District<select className="mt-1 w-full rounded border border-input bg-background p-2" value={districtCode} disabled={!stateCode} onChange={(e) => { setDistrictCode(e.target.value); setComplexCode(""); resetCourts(); }}><option value="">Select district</option>{districtsQuery.data?.map((item) => <option key={item.districtCode} value={item.districtCode}>{item.districtName}</option>)}</select></label>
              <label className="text-sm">Court complex<select className="mt-1 w-full rounded border border-input bg-background p-2" value={complexCode} disabled={!districtCode} onChange={(e) => { setComplexCode(e.target.value); resetCourts(); }}><option value="">Select complex</option>{complexesQuery.data?.map((item) => <option key={item.courtComplexCode} value={item.courtComplexCode}>{item.courtComplexName}</option>)}</select></label>
            </div>
            {courtsQuery.data?.length ? <div className="grid gap-2 sm:grid-cols-2">{courtsQuery.data.map((court, index) => {
              const id = JSON.stringify({ state: stateCode, district_code: districtCode, complex_code: complexCode, court: court.court ?? "", court_no: court.courtNo ?? "" });
              return <label key={`${court.court}-${court.courtNo}-${index}`} className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={profile.court_ids.includes(id)} onChange={() => toggleCourt(court)} />{court.courtName}</label>;
            })}</div> : null}
            {statesQuery.isError || districtsQuery.isError || complexesQuery.isError || courtsQuery.isError ? <p role="alert" className="text-sm text-destructive">Could not load court locations from eCourtsIndia.</p> : null}
            {profile.court_ids.length > 0 && <p className="text-xs text-muted-foreground">{profile.court_ids.length} court(s) selected.</p>}
          </fieldset>
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
        <div className="mt-4 space-y-3">
          {profileQuery.isLoading || scheduleQuery.isLoading ? <p className="text-sm">Checking cause-list status…</p> : null}
          {!profileQuery.isLoading && docketState === "setup" && (
            <div className="space-y-4" data-testid="docket-setup-state">
              <p className="text-sm">Complete these steps to set up your cause list.</p>
              <Button type="button" onClick={() => focusFormField(firstIncompleteField())}>Set up my cause list</Button>
              <ul className="space-y-3">
                <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
                  <div className="flex min-w-0 items-start gap-2">
                    {profile.cause_list_name.trim() && profile.enrolment_number.trim()
                      ? <Check aria-label="Done" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      : <Circle aria-label="Not done" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                    <div><p className="text-sm font-medium">Add your enrolment number</p><p className="text-xs text-muted-foreground">Also confirm your name as it appears on the cause list.</p></div>
                  </div>
                  <Button type="button" variant="outline" onClick={() => focusFormField(!profile.cause_list_name.trim() ? "docket-name" : "docket-enrolment")}>Add details</Button>
                </li>
                <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
                  <div className="flex min-w-0 items-start gap-2">
                    {profile.court_ids.some((court) => court.trim())
                      ? <Check aria-label="Done" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      : <Circle aria-label="Not done" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                    <p className="text-sm font-medium">Choose your courts</p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => focusFormField("docket-courts")}>Choose courts</Button>
                </li>
                <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
                  <div className="flex min-w-0 items-start gap-2">
                    {trackedCasesCount > 0
                      ? <Check aria-label="Done" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      : <Circle aria-label="Not done" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                    <div><p className="text-sm font-medium">Track a case by CNR <span className="font-normal text-muted-foreground">(optional)</span></p>
                      {trackedCasesCount > 0 && <p className="text-xs text-muted-foreground">{trackedCasesCount} active case{trackedCasesCount === 1 ? "" : "s"} tracked</p>}</div>
                  </div>
                  <Button type="button" variant="outline" onClick={() => setLocation("/cnr-tracker")}>Track a case</Button>
                </li>
              </ul>
            </div>
          )}
          {!profileQuery.isLoading && docketState === "pending" && (
            <div className="space-y-3" data-testid="docket-pending-state">
              <p className="text-sm">Your cause list will appear after the next update at 06:00 or 12:00 IST.</p>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Courts being watched</p>
                  <ul className="mt-1 space-y-1 text-sm">{watchedCourts.map((court, index) => <li key={`${court}-${index}`}>{court}</li>)}</ul>
                </div>
                <Button type="button" variant="link" className="h-auto px-0" onClick={() => focusFormField("docket-courts")}>Edit courts</Button>
              </div>
            </div>
          )}
          {!profileQuery.isLoading && docketState === "error" && (
            <p role="alert" className="text-sm text-destructive" data-testid="docket-error-state">
              {schedule?.message ?? "The cause-list source could not be reached. The next scheduled update will retry."}
            </p>
          )}
          {!profileQuery.isLoading && docketState === "empty" && (
            <p className="text-sm" data-testid="docket-empty-state">
              No listings found for you today{lastUpdated ? ` · Last updated ${lastUpdated}` : ""}.
            </p>
          )}
          {!profileQuery.isLoading && docketState === "matters" && (["today", "tomorrow"] as const).map((period) => {
            const list = schedule?.[period];
            if (!list?.matters.length) return null;
            return <div key={period} className="mt-3">
              <h3 className="text-sm font-semibold">{period === "today" ? "Today" : "Tomorrow"}’s matters</h3>
              {list.matters.map((matter, index) => <article key={`${String(matter.cnr ?? "matter")}-${index}`} className="mt-2 rounded-lg border border-border bg-background p-3 text-sm">
                <strong>{matterTitle(matter)}</strong>
                <p className="text-xs text-muted-foreground">{String(matter.cnr ?? "")} · {String(matter.courtName ?? matter.court_name ?? "")} · {String(matter.courtNo ?? matter.court_no ?? "")}</p>
              </article>)}
            </div>;
          })}
          {scheduleQuery.isError && <p role="alert" className="text-sm text-destructive">Could not check cause-list status. Try again later.</p>}
          <a className="inline-flex items-center gap-1 text-sm text-primary underline" href={schedule?.source_url ?? OFFICIAL_CAUSE_LIST_URL} target="_blank" rel="noreferrer">Open official eCourts cause list <ExternalLink className="h-3 w-3" /></a>
        </div>
      </section>
    </main>
  );
}
