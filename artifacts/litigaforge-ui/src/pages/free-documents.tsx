import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { SEOHelmet } from "@/components/SEOHelmet";
import {
  Search, Home, Mail, FileKey, FileCheck, Shield, Scroll,
  MessageCircleWarning, UserMinus, Receipt, Building2, Clock,
  ArrowRight, Filter, X, FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/PageShell";

const ICON_MAP: Record<string, React.ElementType> = {
  Home, Mail, FileKey, FileCheck, Shield, Scroll,
  MessageCircleWarning, UserMinus, Receipt, Building2, FileText,
};

const CATEGORIES = [
  { id: "all", label: "All Templates" },
  { id: "Property", label: "Property" },
  { id: "Civil", label: "Civil" },
  { id: "Family", label: "Family" },
  { id: "Business", label: "Business" },
  { id: "Consumer", label: "Consumer" },
  { id: "Finance", label: "Finance" },
  { id: "General", label: "General" },
];

const CAT_COLORS: Record<string, string> = {
  Property: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Civil: "bg-blue-100 text-blue-700 border-blue-200",
  Family: "bg-pink-100 text-pink-700 border-pink-200",
  Business: "bg-amber-100 text-amber-700 border-amber-200",
  Consumer: "bg-orange-100 text-orange-700 border-orange-200",
  Finance: "bg-violet-100 text-violet-700 border-violet-200",
  General: "bg-slate-100 text-slate-700 border-slate-200",
};

interface TemplateMeta {
  slug: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  estimated_time: string;
  field_count: number;
}

function TemplateCard({ t }: { t: TemplateMeta }) {
  const Icon = ICON_MAP[t.icon] || FileText;
  const catColor = CAT_COLORS[t.category] || CAT_COLORS.General;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-primary/30 transition-all group"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium border", catColor)}>
            {t.category}
          </span>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2 leading-tight">{t.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2">{t.description}</p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> {t.estimated_time}
          </span>
          <span className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" /> {t.field_count} fields
          </span>
        </div>
        <Link href={`/free-documents/${t.slug}`}>
          <Button className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors" variant="outline">
            Fill & Generate <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}

export default function FreeDocuments() {
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("all");

  const { data, isLoading } = useQuery<{ total: number; templates: TemplateMeta[] }>({
    queryKey: ["free-document-templates"],
    queryFn: () => apiFetch("/documents/free/templates"),
  });

  const templates = data?.templates || [];
  const filtered = templates.filter(t => {
    const matchesSearch = !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    const matchesCat = activeCat === "all" || t.category === activeCat;
    return matchesSearch && matchesCat;
  });

  return (
    <>
      <SEOHelmet
        title="Free Legal Documents"
        description="Generate free, AI-powered legal documents for India. Rent agreements, legal notices, wills, NDAs, and more."
        canonical="/free-documents"
      />
      <PageShell title="Free Legal Documents" subtitle="Generate legally sound documents in minutes. Fill the form, let AI draft it, download instantly. No lawyer fees for standard templates.">
        {/* Search + Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                  activeCat === c.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl h-64 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No templates match your search.</p>
            <Button variant="outline" onClick={() => { setSearch(""); setActiveCat("all"); }} className="mt-4">
              Clear Filters
            </Button>
          </div>
        ) : (
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filtered.map(t => (
                <TemplateCard key={t.slug} t={t} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Disclaimer */}
        <div className="mt-12 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-medium mb-1">Important Disclaimer</p>
          <p>These AI-generated documents are templates for informational use. For legally binding documents or complex situations, consult a qualified lawyer. LitigaForge is not a law firm.</p>
        </div>
      </PageShell>
    </>
  );
}
