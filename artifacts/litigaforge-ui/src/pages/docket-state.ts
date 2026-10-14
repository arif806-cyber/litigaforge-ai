export type DocketProfileState = {
  cause_list_name?: string | null;
  enrolment_number?: string | null;
  court_ids?: string[] | null;
} | null;

export type DocketScheduleState = {
  today?: { matters?: unknown[] };
  tomorrow?: { matters?: unknown[] };
  fetched_at?: string | null;
  source_status?: string;
} | null;

export type DocketViewState = "setup" | "pending" | "error" | "empty" | "matters";

export function isDocketProfileComplete(profile: DocketProfileState): boolean {
  return Boolean(
    profile?.cause_list_name?.trim()
    && profile.enrolment_number?.trim()
    && profile.court_ids?.some((court) => court.trim()),
  );
}

export function getDocketViewState(
  profile: DocketProfileState,
  schedule: DocketScheduleState,
): DocketViewState {
  if (!isDocketProfileComplete(profile)) return "setup";
  if (schedule?.source_status === "upstream_error") return "error";
  if (!schedule?.fetched_at) return "pending";
  const hasMatters = Boolean(schedule.today?.matters?.length || schedule.tomorrow?.matters?.length);
  return hasMatters ? "matters" : "empty";
}
