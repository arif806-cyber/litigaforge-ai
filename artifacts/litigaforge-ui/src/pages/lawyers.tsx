import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Users, Phone, Mail, Star, BadgeCheck, Search, Plus, X, Loader2, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const DISTRICTS = [
  "All Districts", "Hyderabad", "Rangareddy", "Warangal", "Karimnagar",
  "Khammam", "Nizamabad", "Nalgonda", "Medak", "Adilabad", "Mahbubnagar",
];

const PRACTICE_AREAS = [
  "All Areas", "Property & Real Estate", "Criminal Defense", "Family Law",
  "GST & Tax", "Banking & Finance", "Labour Law", "Civil Matters",
  "Corporate Law", "Motor Accident Claims", "Consumer Forum",
  "Revenue Law", "RERA", "Insolvency", "Intellectual Property", "NDPS",
];

const LANGUAGES = ["All Languages", "Telugu", "English", "Hindi", "Urdu", "Tamil", "Bengali"];

interface Lawyer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  bar_number: string | null;
  district: string;
  practice_areas: string[];
  languages: string[];
  experience_years: number;
  rating: number;
  bio: string;
  verified: boolean;
}

function LawyerCard({ lawyer }: { lawyer: Lawyer }) {
  const [showContact, setShowContact] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4 hover:border-primary/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-bold text-gray-900 text-sm">{lawyer.name}</h3>
            {lawyer.verified && (
              <BadgeCheck className="w-4 h-4 text-primary flex-shrink-0" title="Verified advocate" />
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
            <span>{lawyer.district}</span>
            <span>·</span>
            <span>{lawyer.experience_years}y exp</span>
            {lawyer.bar_number && (
              <>
                <span>·</span>
                <span className="text-gray-400">BCI: {lawyer.bar_number}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
          <span className="text-sm font-bold text-gray-900 font-mono">{lawyer.rating}</span>
        </div>
      </div>

      {/* Practice areas */}
      <div className="flex flex-wrap gap-1.5">
        {lawyer.practice_areas.map(area => (
          <span key={area} className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/8 text-primary border border-primary/20">
            {area}
          </span>
        ))}
      </div>

      {/* Languages */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="font-mono uppercase tracking-widest text-[10px] text-gray-400">Languages:</span>
        {lawyer.languages.join(", ")}
      </div>

      {lawyer.bio && (
        <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{lawyer.bio}</p>
      )}

      {/* Contact */}
      <div>
        <button
          onClick={() => setShowContact(s => !s)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition"
        >
          <Phone className="w-3.5 h-3.5" />
          {showContact ? "Hide Contact" : "Show Contact"}
        </button>
        <AnimatePresence>
          {showContact && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-2 text-sm">
                {lawyer.phone && (
                  <a href={`tel:${lawyer.phone}`}
                    className="flex items-center gap-2 text-primary hover:underline font-mono">
                    <Phone className="w-3.5 h-3.5" />{lawyer.phone}
                  </a>
                )}
                {lawyer.email && (
                  <a href={`mailto:${lawyer.email}`}
                    className="flex items-center gap-2 text-primary hover:underline font-mono">
                    <Mail className="w-3.5 h-3.5" />{lawyer.email}
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function RegisterModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: user?.name ?? "", phone: "", email: "", district: "Hyderabad",
    bar_number: "", experience_years: 0, bio: "",
    practice_areas: [] as string[], languages: ["Telugu", "English"],
  });
  const [success, setSuccess] = useState(false);

  const register = useMutation({
    mutationFn: (data: typeof form) =>
      apiFetch("/lawyers/register", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { setSuccess(true); qc.invalidateQueries({ queryKey: ["lawyers"] }); },
  });

  const toggleArea = (area: string) =>
    setForm(f => ({
      ...f,
      practice_areas: f.practice_areas.includes(area)
        ? f.practice_areas.filter(a => a !== area)
        : [...f.practice_areas, area],
    }));

  return (
    <div className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-900">Register as Advocate</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-10 text-center space-y-3">
            <BadgeCheck className="w-12 h-12 text-primary mx-auto" />
            <h4 className="font-bold text-gray-900">Profile Submitted!</h4>
            <p className="text-sm text-gray-600">Your profile will appear in the directory after verification by our team.</p>
            <button onClick={onClose} className="mt-2 px-6 py-2 rounded-xl bg-primary text-white text-sm font-bold">Done</button>
          </div>
        ) : (
          <form
            onSubmit={e => { e.preventDefault(); register.mutate(form); }}
            className="px-6 py-5 space-y-4"
          >
            {[
              { label: "Full Name", key: "name", placeholder: "Adv. Full Name" },
              { label: "Phone", key: "phone", placeholder: "+91-XXXXXXXXXX" },
              { label: "Email (optional)", key: "email", placeholder: "advocate@example.com" },
              { label: "Bar Council No. (optional)", key: "bar_number", placeholder: "TS/XXXX/YYYY" },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-1.5">{label}</label>
                <input
                  value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                />
              </div>
            ))}

            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-1.5">District</label>
              <select
                value={form.district}
                onChange={e => setForm(f => ({ ...f, district: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
              >
                {DISTRICTS.slice(1).map(d => <option key={d}>{d}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-1.5">Experience (years)</label>
              <input
                type="number" min={0} max={60}
                value={form.experience_years}
                onChange={e => setForm(f => ({ ...f, experience_years: parseInt(e.target.value) || 0 }))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">Practice Areas</label>
              <div className="flex flex-wrap gap-2">
                {PRACTICE_AREAS.slice(1).map(area => (
                  <button
                    key={area} type="button"
                    onClick={() => toggleArea(area)}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-full border transition-all",
                      form.practice_areas.includes(area)
                        ? "bg-primary text-white border-primary"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:border-primary/40"
                    )}
                  >{area}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-1.5">Bio</label>
              <textarea
                value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                rows={3}
                placeholder="Brief professional summary..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 transition resize-none"
              />
            </div>

            {register.isError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {(register.error as Error).message}
              </p>
            )}

            <button
              type="submit"
              disabled={!form.name || !form.phone || form.practice_areas.length === 0 || register.isPending}
              className="w-full h-11 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {register.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : "Submit Profile"}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

export default function LawyersPage() {
  const { user } = useAuth();
  const [district, setDistrict] = useState("All Districts");
  const [practiceArea, setPracticeArea] = useState("All Areas");
  const [searchText, setSearchText] = useState("");
  const [showRegister, setShowRegister] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["lawyers", district, practiceArea, searchText],
    queryFn: () => {
      const params = new URLSearchParams();
      if (district !== "All Districts") params.set("district", district);
      if (practiceArea !== "All Areas") params.set("practice_area", practiceArea);
      if (searchText) params.set("search", searchText);
      return apiFetch(`/lawyers?${params}`);
    },
    staleTime: 60000,
  });

  return (
    <div className="h-full flex flex-col relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent pointer-events-none" />

      <div className="px-4 py-5 md:px-10 md:py-8 flex-shrink-0 relative z-10 border-b border-gray-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
              <Users className="w-6 h-6 text-primary" />
              Lawyer Directory
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Verified Telangana & AP advocates — filter by district, practice area, and language.
            </p>
          </div>
          {user && (
            <button
              onClick={() => setShowRegister(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition shadow-sm flex-shrink-0"
            >
              <Plus className="w-4 h-4" /> List Your Profile
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-6 md:px-10 md:py-8 relative z-10">
        <div className="max-w-5xl space-y-6 pb-20">

          {/* Filters */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="Search by name or specialisation…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
              />
            </div>
            <select
              value={district}
              onChange={e => setDistrict(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
            >
              {DISTRICTS.map(d => <option key={d}>{d}</option>)}
            </select>
            <select
              value={practiceArea}
              onChange={e => setPracticeArea(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
            >
              {PRACTICE_AREAS.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>

          {/* Count */}
          {!isLoading && data && (
            <p className="text-sm text-gray-500 font-mono">{data.total} advocate{data.total !== 1 ? "s" : ""} found</p>
          )}

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1,2,3,4].map(i => <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(data?.lawyers ?? []).map((lawyer: Lawyer) => (
                <LawyerCard key={lawyer.id} lawyer={lawyer} />
              ))}
              {(data?.lawyers ?? []).length === 0 && (
                <div className="col-span-2 text-center py-16">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-4">
                    <Search className="w-7 h-7 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium mb-1">No advocates found</p>
                  <p className="text-gray-400 text-xs max-w-sm mx-auto mb-4">
                    The directory is currently empty. Be the first to list your profile.
                  </p>
                  {user ? (
                    <button
                      onClick={() => setShowRegister(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition shadow-sm"
                    >
                      <Plus className="w-4 h-4" /> List Your Profile
                    </button>
                  ) : (
                    <a
                      href="/register"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition shadow-sm"
                    >
                      <Plus className="w-4 h-4" /> Sign Up & List Your Profile
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showRegister && <RegisterModal onClose={() => setShowRegister(false)} />}
      </AnimatePresence>
    </div>
  );
}
