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
