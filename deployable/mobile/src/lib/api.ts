import axios from "axios";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://YOUR_DEPLOYED_DOMAIN.replit.app";

export const api = axios.create({
  baseURL: `${BASE_URL}/litigaforge`,
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
});

export type ForgeResult = {
  status: string;
  case_id: string;
  chains_executed: string[];
  chain_map: Record<string, string[]>;
  entities_found: Record<string, string[]>;
  api_results: Record<string, unknown>;
  meta_suggestions: string[];
  final_output: string;
};

export type CaseItem = {
  case_id: string;
  timestamp: string;
  prompt_preview: string;
};

export type ChainItem = {
  name: string;
  description: string;
};

export type CaseRequirement = {
  id: number;
  title: string;
  case_type: string;
  description: string;
  location: string;
  budget_range: string;
  is_anonymous: boolean;
  status: string;
  created_at: string;
};

export type Match = {
  id: number;
  case_requirement_id: number;
  lawyer_id: number;
  lawyer_name: string;
  district: string;
  practice_areas: string[];
  experience_years: number;
  rating: number;
  hourly_rate: number;
  match_score: number;
  ai_explanation: string;
  status: "pending" | "accepted" | "declined";
  case_title: string;
  budget_range: string;
};

export type ChatReply = {
  reply: string;
};

export async function forgeCase(prompt: string): Promise<ForgeResult> {
  const { data } = await api.post<ForgeResult>("/forge", { prompt });
  return data;
}

export async function listCases(limit = 20): Promise<CaseItem[]> {
  const { data } = await api.get<{ cases: CaseItem[] }>("/cases", { params: { limit } });
  return data.cases;
}

export async function getCase(caseId: string): Promise<unknown> {
  const { data } = await api.get(`/cases/${caseId}`);
  return data;
}

export async function listChains(): Promise<ChainItem[]> {
  const { data } = await api.get<{ chains: ChainItem[] }>("/chains");
  return data.chains;
}

export async function postCaseRequirement(payload: {
  title: string;
  case_type: string;
  description: string;
  location: string;
  budget_range: string;
  budget_min: number;
  budget_max: number;
  is_anonymous: boolean;
}): Promise<CaseRequirement> {
  const { data } = await api.post<CaseRequirement>("/cases/requirements", payload);
  return data;
}

export async function listMyRequirements(): Promise<CaseRequirement[]> {
  const { data } = await api.get<{ total: number; cases: CaseRequirement[] }>(
    "/cases/requirements/mine"
  );
  return data.cases ?? [];
}

export async function getClientMatches(): Promise<{ matches: Match[]; total: number }> {
  const { data } = await api.get<{ matches: Match[]; total: number }>("/matches/client");
  return data;
}

export async function findLawyersForCase(caseRequirementId: number): Promise<void> {
  await api.post("/match/find-lawyers", { case_requirement_id: caseRequirementId });
}

export async function acceptMatch(matchId: number): Promise<void> {
  await api.post(`/matches/${matchId}/accept`);
}

export async function declineMatch(matchId: number): Promise<void> {
  await api.post(`/matches/${matchId}/decline`);
}

export async function sendLegalChat(
  message: string,
  context: string,
  country = "IN"
): Promise<ChatReply> {
  const { data } = await api.post<ChatReply>("/ai-legal-chat", {
    message,
    context,
    country,
  });
  return data;
}
