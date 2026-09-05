import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { getCountryFromPath } from "@/lib/country";
import { useAuth, safeAuthNext } from "@/lib/auth-context";
import { useCountry } from "@/hooks/useCountry";
import { LAWYERS_COPY } from "@/lib/country-copy";
import { Users, Phone, Mail, Star, BadgeCheck, Search, Plus, X, Loader2, ChevronDown, MapPin, Briefcase, AlertTriangle, Globe2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { SEOHelmet } from "@/components/SEOHelmet";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";

interface CountryDir {
  name: string;
  currency: string;
  barLabel: string;
  barPlaceholder: string;
  regions: string[];
  practiceAreas: string[];
  languages: string[];
}

const GENERIC_AREAS = [
  "Employment Law", "Family Law", "Immigration", "Property & Real Estate",
  "Criminal Defense", "Civil Litigation", "Corporate & Business", "Consumer Protection",
  "Personal Injury", "Contract Disputes", "Tax", "Intellectual Property",
];

const COUNTRY_DIR: Record<string, CountryDir> = {
  IN: {
    name: "India", currency: "₹", barLabel: "BCI", barPlaceholder: "TS/XXXX/YYYY",
    regions: ["Hyderabad", "Rangareddy", "Warangal", "Karimnagar", "Khammam", "Nizamabad", "Nalgonda", "Medak", "Adilabad", "Mahbubnagar"],
    practiceAreas: ["Property & Real Estate", "Criminal Defense", "Family Law", "GST & Tax", "Banking & Finance", "Labour Law", "Civil Matters", "Corporate Law", "Motor Accident Claims", "Consumer Forum", "Revenue Law", "RERA", "Insolvency", "Intellectual Property", "NDPS"],
    languages: ["Telugu", "English", "Hindi", "Urdu", "Tamil", "Bengali"],
  },
  US: {
    name: "United States", currency: "$", barLabel: "State Bar No.", barPlaceholder: "Bar No.",
    regions: ["California", "New York", "Texas", "Florida", "Illinois", "Washington", "Massachusetts", "Georgia"],
    practiceAreas: GENERIC_AREAS, languages: ["English", "Spanish"],
  },
  GB: {
    name: "United Kingdom", currency: "£", barLabel: "SRA No.", barPlaceholder: "SRA No.",
    regions: ["London", "Manchester", "Birmingham", "Leeds", "Glasgow", "Bristol", "Edinburgh"],
    practiceAreas: GENERIC_AREAS, languages: ["English"],
  },
  AE: {
    name: "United Arab Emirates", currency: "د.إ", barLabel: "MOJ Licence", barPlaceholder: "MOJ Licence No.",
    regions: ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah"],
    practiceAreas: ["Labour & Employment", "Tenancy & Real Estate", "Business Setup", "Visa & Immigration", "Cheque & Debt", "Traffic & Accidents", "Family Law", "Criminal Defense", "Commercial Disputes"],
    languages: ["Arabic", "English", "Hindi", "Urdu"],
  },
  AU: {
    name: "Australia", currency: "A$", barLabel: "Practising Cert.", barPlaceholder: "Cert. No.",
    regions: ["New South Wales", "Victoria", "Queensland", "Western Australia", "South Australia", "Tasmania", "ACT"],
    practiceAreas: GENERIC_AREAS, languages: ["English"],
  },
  CA: {
    name: "Canada", currency: "CA$", barLabel: "Law Society No.", barPlaceholder: "LSO No.",
    regions: ["Ontario", "Quebec", "British Columbia", "Alberta", "Manitoba", "Nova Scotia"],
    practiceAreas: GENERIC_AREAS, languages: ["English", "French"],
  },
  SG: {
    name: "Singapore", currency: "S$", barLabel: "Practising Cert.", barPlaceholder: "Cert. No.",
    regions: ["Central", "East", "West", "North", "North-East"],
    practiceAreas: GENERIC_AREAS, languages: ["English", "Mandarin", "Malay", "Tamil"],
  },
  DE: {
    name: "Germany", currency: "€", barLabel: "RAK No.", barPlaceholder: "RAK No.",
    regions: ["Berlin", "Bayern", "Hamburg", "Nordrhein-Westfalen", "Hessen", "Baden-Württemberg"],
    practiceAreas: GENERIC_AREAS, languages: ["German", "English"],
  },
};

interface Lawyer {
  id: number;
  name: string;
  district: string;
  country?: string;
  practice_areas: string[];
  languages: string[];
  experience_years: number;
  rating: number;
  review_count?: number;
  hourly_rate?: number;
  bio: string;
  verified: boolean;
}

function LawyerCard({ lawyer, dir }: { lawyer: Lawyer; dir: CountryDir }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-border shadow-sm p-6 flex flex-col hover:border-primary/40 hover:shadow-md transition-all duration-300"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="font-bold text-lg text-foreground truncate">{lawyer.name}</h3>
            {lawyer.verified && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5 flex-shrink-0">
                <BadgeCheck className="w-3.5 h-3.5" />
                Bar Council Verified
              </span>
            )}
          </div>
          <div className="flex items-center flex-wrap gap-y-1 gap-x-3 text-sm text-muted-foreground font-medium">
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{lawyer.district}</span>
            <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{lawyer.experience_years}y exp</span>
            {lawyer.hourly_rate && (
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                {dir.currency}{lawyer.hourly_rate.toLocaleString()}/hr
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center justify-center bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 min-w-[56px] flex-shrink-0">
           <Star className="w-4 h-4 text-amber-500 fill-amber-500 mb-1" />
           <span className="text-sm font-bold text-amber-400 font-mono leading-none">{lawyer.rating}</span>
        </div>
      </div>

      <div className="mb-4">
         <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Practice Areas</p>
         <div className="flex flex-wrap gap-2">
          {lawyer.practice_areas.map(area => (
            <span key={area} className="text-xs font-medium px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20">
              {area}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Languages</p>
        <p className="text-sm font-medium text-foreground/80">{lawyer.languages.join(", ")}</p>
      </div>

      {lawyer.bio && (
        <div className="mb-6 flex-1">
          <p className="text-sm text-foreground/70 leading-relaxed line-clamp-3 bg-muted/30 p-3 rounded-lg border border-border/50">{lawyer.bio}</p>
        </div>
      )}

      <p className="mt-auto text-xs text-muted-foreground text-center">Contact details are shared only after an accepted match.</p>
    </motion.div>
  );
}

function RegisterModal({ onClose, dir, countryCode }: { onClose: () => void; dir: CountryDir; countryCode: string }) {
  const { user, refreshUser } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: user?.name ?? "", phone: "", email: "", district: dir.regions[0],
    bar_number: "", experience_years: 0, bio: "",
    practice_areas: [] as string[], languages: dir.languages.slice(0, 2),
    country: countryCode.toLowerCase(),
  });
  const [success, setSuccess] = useState(false);

  const register = useMutation({
    mutationFn: (data: typeof form) =>
      apiFetch("/lawyers/register", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: async () => {
      setSuccess(true);
      qc.invalidateQueries({ queryKey: ["lawyers"] });
      // A new advocate must finish this profile before entering Workspace.
      // Re-read auth so subsequent route guards see the server's status.
      await refreshUser();
      let next: string | null = null;
      try { next = safeAuthNext(sessionStorage.getItem("lf_return_to")); } catch { /* storage unavailable */ }
      if (next) {
        try { sessionStorage.removeItem("lf_return_to"); } catch { /* storage unavailable */ }
        window.location.href = next;
      }
    },
  });

  const toggleArea = (area: string) =>
    setForm(f => ({
      ...f,
      practice_areas: f.practice_areas.includes(area)
        ? f.practice_areas.filter(a => a !== area)
        : [...f.practice_areas, area],
    }));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-8 py-6 border-b border-border">
          <div>
            <h3 className="text-xl font-bold text-foreground tracking-tight">Register as Advocate</h3>
            <p className="text-sm text-muted-foreground mt-1 font-medium">Join the LitigaForge directory — {dir.name}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="px-8 py-16 text-center flex-1 overflow-y-auto">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
              <BadgeCheck className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h4 className="text-2xl font-bold text-foreground mb-2">Profile Submitted!</h4>
            <p className="text-muted-foreground font-medium max-w-md mx-auto mb-8">
              Your profile is under review and will appear in the directory after verification by our team.
            </p>
            <Button onClick={onClose} size="lg" className="px-8">Close</Button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <form onSubmit={e => { e.preventDefault(); register.mutate(form); }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { label: "Full Name", key: "name", placeholder: "Adv. Full Name", type: "text", required: true },
                  { label: "Phone Number", key: "phone", placeholder: "Phone number", type: "text", required: true },
                  { label: "Email Address (optional)", key: "email", placeholder: "advocate@example.com", type: "email", required: false },
                  { label: `${dir.barLabel} (optional)`, key: "bar_number", placeholder: dir.barPlaceholder, type: "text", required: false },
                ].map(({ label, key, placeholder, type, required }) => (
                  <div key={key}>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      {label} {required && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      type={type}
                      value={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      required={required}
                      className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Region *</label>
                  <div className="relative">
                    <select
                      value={form.district}
                      onChange={e => setForm(f => ({ ...f, district: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm appearance-none"
                    >
                      {dir.regions.map(d => <option key={d}>{d}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Experience (years) *</label>
                  <input
                    type="number" min={0} max={60}
                    value={form.experience_years}
                    onChange={e => setForm(f => ({ ...f, experience_years: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="bg-muted/30 p-6 rounded-2xl border border-border">
                <label className="block text-sm font-semibold text-foreground mb-3">Practice Areas *</label>
                <div className="flex flex-wrap gap-2">
                  {dir.practiceAreas.map(area => (
                    <button
                      key={area} type="button"
                      onClick={() => toggleArea(area)}
                      className={cn(
                        "text-sm font-medium px-4 py-2 rounded-full border transition-all",
                        form.practice_areas.includes(area)
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                      )}
                    >{area}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Professional Bio</label>
                <textarea
                  value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  rows={4}
                  placeholder="Brief summary of your practice, courts you appear in, and notable achievements..."
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm resize-none"
                />
              </div>

              {register.isError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {(register.error as Error).message}
                </div>
              )}
            </form>
          </div>
        )}

        {!success && (
          <div className="px-8 py-5 border-t border-border bg-muted/20 rounded-b-2xl flex justify-end gap-3">
             <Button variant="outline" onClick={onClose}>Cancel</Button>
             <Button
                onClick={() => register.mutate(form)}
                disabled={!form.name || !form.phone || form.practice_areas.length === 0 || register.isPending}
                className="px-8"
             >
                {register.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting…</> : "Submit Profile for Review"}
             </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function LawyersPage() {
  const { user } = useAuth();
  const { activeCode } = useCountry();
  const cc = (getCountryFromPath() || activeCode || "in").toUpperCase();
  const copy = LAWYERS_COPY[cc] ?? LAWYERS_COPY.IN;
  const dir = COUNTRY_DIR[cc] ?? COUNTRY_DIR.IN;
  const allRegions = `All Regions`;
  const allAreas = `All Areas`;
  const [district, setDistrict] = useState(allRegions);
  const [practiceArea, setPracticeArea] = useState(allAreas);
  const [searchText, setSearchText] = useState("");
  const [location] = useLocation();
  const [showRegister, setShowRegister] = useState(location === "/lawyers/register");

  const { data, isLoading } = useQuery({
    queryKey: ["lawyers", cc, district, practiceArea, searchText],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("country", cc.toLowerCase());
      if (district !== allRegions) params.set("district", district);
      if (practiceArea !== allAreas) params.set("practice_area", practiceArea);
      if (searchText) params.set("search", searchText);
      return apiFetch(`/lawyers?${params}`);
    },
    staleTime: 60000,
  });

  const lawyersStructuredData = (data?.lawyers?.length ?? 0) > 0
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": `Verified Lawyers — ${dir.name}`,
        "description": `AI-matched verified advocates listed by region and practice area on LitigaForge AI`,
        "itemListElement": (data.lawyers as Lawyer[]).slice(0, 20).map((l, i) => ({
          "@type": "ListItem",
          "position": i + 1,
          "item": {
            "@type": "LegalService",
            "name": l.name,
            "description": l.bio || l.practice_areas.join(", ") || "Verified advocate",
            "areaServed": l.district,
            ...(l.hourly_rate ? { "priceRange": `${dir.currency}${l.hourly_rate}/hr` } : {}),
            ...(l.rating > 0 && (l.review_count ?? 0) > 0
              ? {
                  "aggregateRating": {
                    "@type": "AggregateRating",
                    "ratingValue": l.rating,
                    "reviewCount": l.review_count,
                    "bestRating": 5,
                    "worstRating": 1,
                  },
                }
              : {}),
          },
        })),
      }
    : undefined;

  return (
    <PageShell title={copy.pageTitle} subtitle={copy.pageSubtitle} icon={<Users className="w-6 h-6 text-primary" />}
      action={(user?.role === "lawyer" || user?.role === "advocate") ? (
        <Button onClick={() => setShowRegister(true)} size="lg" className="shadow-md flex-shrink-0">
          <Plus className="w-5 h-5 mr-2" /> List Your Profile
        </Button>
      ) : undefined}>
      <div className="space-y-8">
        <SEOHelmet
          title={`Find Verified Lawyers in ${dir.name} | LitigaForge`}
          description={`Search verified advocates across ${dir.name}. Filter by region, practice area, language, and ratings. View credentials and contact directly.`}
          canonical="/lawyers"
          keywords={`find lawyer ${dir.name}, verified advocate ${dir.name}, advocate directory, legal help ${dir.name}`}
          structuredData={lawyersStructuredData}
        />
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Search by name or specialisation…"
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-input bg-background text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm"
            />
          </div>
          <div className="relative w-full md:w-64">
            <select
              value={district}
              onChange={e => setDistrict(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-input bg-background text-base font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm appearance-none"
            >
              {[allRegions, ...dir.regions].map(d => <option key={d}>{d}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          <div className="relative w-full md:w-72">
             <select
              value={practiceArea}
              onChange={e => setPracticeArea(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-input bg-background text-base font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm appearance-none"
            >
              {[allAreas, ...dir.practiceAreas].map(a => <option key={a}>{a}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center justify-between pb-2 border-b border-border/50">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
             Results
          </h3>
          {!isLoading && data && (
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
              {data.total} advocate{data.total !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1,2,3,4].map(i => <div key={i} className="h-64 bg-card border border-border rounded-2xl animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {(data?.lawyers ?? []).map((lawyer: Lawyer) => (
              <LawyerCard key={lawyer.id} lawyer={lawyer} dir={dir} />
            ))}
            {(data?.lawyers ?? []).length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-24 bg-card border border-border rounded-2xl border-dashed">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Globe2 className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Our verified directory is expanding to {dir.name}</h3>
                <p className="text-muted-foreground font-medium max-w-md text-center mb-8">
                  We're onboarding verified advocates in {dir.name} now. In the meantime, you can still post your case and our AI will help match you, or be the first advocate listed here.
                </p>
                {user?.role === "lawyer" || user?.role === "advocate" ? (
                  <Button onClick={() => setShowRegister(true)} size="lg">
                    <Plus className="w-5 h-5 mr-2" /> Be the first to list your profile
                  </Button>
                ) : (
                  <Link href="/post-case">
                    <Button size="lg"><Plus className="w-5 h-5 mr-2" /> Post your case</Button>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showRegister && <RegisterModal onClose={() => setShowRegister(false)} dir={dir} countryCode={cc} />}
      </AnimatePresence>
    </PageShell>
  );
}
