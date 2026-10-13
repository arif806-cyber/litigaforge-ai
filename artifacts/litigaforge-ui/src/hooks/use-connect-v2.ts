import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface ConnectFlags {
  connect_v2: boolean;
  multilang: boolean;
  phase1: string[];
  phase2: string[];
  phase3: string[];
  languages_needing_review: string[];
}

export const CONNECT_FLAGS_KEY = ["connect-v2-flags"];
export const CONNECT_LANGUAGE_STORAGE_KEY = "lf_preferred_language";

export function useConnectFlags() {
  return useQuery<ConnectFlags>({
    queryKey: CONNECT_FLAGS_KEY,
    queryFn: () => apiFetch("/connect-v2/flags") as Promise<ConnectFlags>,
    retry: false,
    staleTime: 60_000,
  });
}

export interface ConnectCase {
  id: number;
  problem_type: string;
  description: string;
  location: string;
  language: string;
  status: string;
  documents?: Array<{
    id?: number;
    filename?: string;
    content_type?: string;
    size?: number;
    object_path?: string;
    url?: string;
    path?: string;
  }>;
  document_paths?: string[];
  photos?: Array<string | {
    id?: number;
    filename?: string;
    content_type?: string;
    size?: number;
    object_path?: string;
    url?: string;
    path?: string;
  }>;
  advocate?: {
    name: string;
    verification_status: string;
    practice_areas: string[];
    experience_years: number;
    phone: string;
  } | null;
  next_step: string;
  next_step_date: string | null;
  latest_update: string;
  latest_update_language?: string;
  requested_documents?: Array<{ id: number; label: string; status: string }>;
  thread_id: number | string | null;
  voice_transcript?: string | null;
  voice_language?: string | null;
}

export interface ConnectRequest {
  id: number;
  posted_at: string;
  problem_type: string;
  summary: string;
  location: string;
  document_count: number;
  case_id: number;
}

export const INDIAN_LANGUAGES = {
  phase1: [
    { code: "en", name: "English", native: "English" },
    { code: "hi", name: "Hindi", native: "हिन्दी" },
    { code: "te", name: "Telugu", native: "తెలుగు" },
    { code: "ta", name: "Tamil", native: "தமிழ்" },
    { code: "kn", name: "Kannada", native: "ಕನ್ನಡ" },
    { code: "mr", name: "Marathi", native: "मराठी" },
  ],
  phase2: [
    { code: "ml", name: "Malayalam", native: "മലയാളം" },
    { code: "bn", name: "Bengali", native: "বাংলা" },
    { code: "gu", name: "Gujarati", native: "ગુજરાતી" },
    { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
    { code: "or", name: "Odia", native: "ଓଡ଼ିଆ" },
    { code: "ur", name: "Urdu", native: "اردو" },
  ],
  phase3: [
    { code: "as", name: "Assamese", native: "অসমীয়া" },
    { code: "brx", name: "Bodo", native: "बड़ो" },
    { code: "doi", name: "Dogri", native: "डोगरी" },
    { code: "kok", name: "Konkani", native: "कोंकणी" },
    { code: "ks", name: "Kashmiri", native: "कॉशुर" },
    { code: "mai", name: "Maithili", native: "मैथिली" },
    { code: "mni", name: "Manipuri (Meitei)", native: "মৈতৈলোন্" },
    { code: "ne", name: "Nepali", native: "नेपाली" },
    { code: "sa", name: "Sanskrit", native: "संस्कृतम्" },
    { code: "sat", name: "Santali", native: "ᱥᱟᱱᱛᱟᱲᱤ" },
    { code: "sd", name: "Sindhi", native: "سنڌي" },
  ],
};

export function languageName(code: string) {
  return [...INDIAN_LANGUAGES.phase1, ...INDIAN_LANGUAGES.phase2, ...INDIAN_LANGUAGES.phase3]
    .find((language) => language.code === code)?.name ?? code.toUpperCase();
}
