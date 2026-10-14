import { apiFetch } from "@/lib/api";

export interface CourtBoard {
  now_item: number;
  updated_at: string;
  minutes_ago: number;
  advocates: number;
  stale: boolean;
  minutes_per_item: number | null;
  source: "advocates_in_court";
}

export interface CourtDayMatter {
  case_id: number;
  title: string;
  cnr: string | null;
  case_type: string | null;
  client_name: string | null;
  stage: string | null;
  sensitive: boolean;
  court: string | null;
  hall: string | null;
  item: string | null;
  list_size: number | null;
  court_key: string | null;
  place_source: "cause_list" | "case";
  board: CourtBoard | null;
}

export interface CourtDayResponse {
  date: string;
  today: string;
  week: { date: string; count: number }[];
  matters: CourtDayMatter[];
  notice: string;
}

export interface HearingBrief {
  case_id: number;
  title: string;
  cnr: string | null;
  court: string | null;
  judge: string | null;
  stage: string | null;
  status: string | null;
  next_date: string | null;
  last_orders: { date: string | null; text: string }[];
  checklist: string[];
  law: { old: string; new: string | null; note?: string | null }[];
  sensitive: boolean;
  data_as_of: string | null;
  source: string;
  verify_notice: string;
}

export interface BoardUpdateResult {
  status: "accepted" | "pending";
  message: string;
  board: CourtBoard | null;
}

export const courtDayKey = (day: string | null) => ["court-day", day ?? "today"] as const;

export const fetchCourtDay = (day: string | null) =>
  apiFetch<CourtDayResponse>(`/court-day/today${day ? `?day=${encodeURIComponent(day)}` : ""}`);

export const fetchBrief = (caseId: number) => apiFetch<HearingBrief>(`/court-day/brief/${caseId}`);

export const postBoardUpdate = (courtKey: string, itemNo: number) =>
  apiFetch<BoardUpdateResult>("/court-day/board", { method: "POST", body: { court_key: courtKey, item_no: itemNo } });

/** Numeric part of a cause-list item ("17", "17A" → 17). */
export function itemNumber(item: string | null | undefined): number | null {
  const match = String(item ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

/** How far the advocate's matter is from the matter being heard. */
export function boardProgress(matter: CourtDayMatter) {
  const mine = itemNumber(matter.item);
  const board = matter.board;
  if (!board || mine == null) return null;
  const ahead = Math.max(mine - board.now_item, 0);
  const passed = board.now_item > mine;
  const eta = !board.stale && board.minutes_per_item && ahead > 0 ? Math.round(ahead * board.minutes_per_item) : null;
  return { mine, ahead, passed, eta, fraction: Math.min(board.now_item / mine, 1) };
}

export interface AlertPrefs { enabled: boolean; devices: number; push_configured: boolean }

export const fetchAlertPrefs = () => apiFetch<AlertPrefs>("/court-day/alerts");

export const saveAlertPref = (enabled: boolean) =>
  apiFetch<{ enabled: boolean }>("/court-day/alerts", { method: "PUT", body: { enabled } });
