import { useParams, Link } from "wouter";
import { SEOHelmet } from "@/components/SEOHelmet";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  MapPin, Star, Clock, Phone, ChevronDown, ChevronUp,
  ArrowRight, Scale, Users, BadgeCheck, Building2,
} from "lucide-react";

/* ─── Static city data ─────────────────────────────────────────────────── */

interface CityInfo {
  name: string;
  district: string;          // passed to /lawyers?district=
  state: "Telangana" | "Andhra Pradesh";
  courts: string[];
  feeRange: string;
  avgConsultation: string;
  faqs: { q: string; a: string }[];
}

const CITIES: Record<string, CityInfo> = {
  hyderabad: {
    name: "Hyderabad",
    district: "Hyderabad",
    state: "Telangana",
    courts: ["Telangana High Court", "Hyderabad District Court", "City Civil Court", "Nampally Metropolitan Court"],
    feeRange: "₹15,000–₹1,00,000 per case",
    avgConsultation: "₹1,000–₹5,000",
    faqs: [
      {
        q: "How much does a lawyer cost in Hyderabad?",
        a: "Consultation fees in Hyderabad typically range from ₹1,000 to ₹5,000. Full representation in property and civil cases costs ₹15,000–₹1,00,000 depending on complexity. High Court criminal defence advocates charge ₹50,000–₹5,00,000. Corporate lawyers at Banjara Hills and HITEC City firms often charge ₹10,000+ per hour.",
      },
      {
        q: "Which courts operate in Hyderabad?",
        a: "Hyderabad houses the Telangana High Court (state's apex court), the Hyderabad District Court at Nampally, City Civil Court, Metropolitan Magistrate Courts, and key tribunals — RERA Telangana, District Consumer Forum, DRAT, Labour Court, and NCLT Bench.",
      },
      {
        q: "What types of cases are most common in Hyderabad?",
        a: "The most common cases include property and land disputes (especially in the IT corridor, old city, and Cyberabad areas), criminal bail matters at Nampally Court, family disputes (divorce, custody, maintenance) at the Family Court, consumer complaints against builders and banks, and corporate litigation.",
      },
      {
        q: "How long does a legal case take in Hyderabad?",
        a: "Consumer forum cases typically resolve in 3–6 months. Family court matters (divorce by mutual consent) take 6–18 months. Property civil suits can take 2–7 years in the District Court. High Court matters vary widely. Using AI matching to find the right specialist reduces delays significantly.",
      },
    ],
  },
  secunderabad: {
    name: "Secunderabad",
    district: "Hyderabad",
    state: "Telangana",
    courts: ["Secunderabad Magistrate Court", "Cantonment Board Court", "Hyderabad District Court"],
    feeRange: "₹10,000–₹75,000 per case",
    avgConsultation: "₹800–₹3,000",
    faqs: [
      {
        q: "How much does a lawyer cost in Secunderabad?",
        a: "Advocate fees in Secunderabad are slightly lower than Hyderabad's Banjara Hills rates. Consultations cost ₹800–₹3,000, while full case representation ranges from ₹10,000 to ₹75,000. Cantonment and civil matters are the most common, and experienced advocates for these specialisations charge a premium.",
      },
      {
        q: "Which courts operate in Secunderabad?",
        a: "Secunderabad falls under the Hyderabad District Court jurisdiction at Nampally. The Secunderabad Cantonment area has the Cantonment Board and its associated civil authority. Criminal matters are handled at the Metropolitan Magistrate Courts. The Telangana High Court covers all appeals.",
      },
      {
        q: "What types of cases are most common in Secunderabad?",
        a: "Cantonment property disputes, lease and tenancy issues in the twin-city corridor, criminal matters at the Secunderabad railway police station jurisdiction, and consumer complaints are the most frequent. Army and defence personnel often need advocates for service-related matters.",
      },
      {
        q: "Can I find an advocate in Secunderabad for cantonment matters?",
        a: "Yes. Secunderabad has advocates who specialise in cantonment board land regulations, military service matters, and the unique property laws that apply in cantonment areas. Use LitigaForge AI to filter by district and find verified advocates with relevant experience.",
      },
    ],
  },
  warangal: {
    name: "Warangal",
    district: "Warangal",
    state: "Telangana",
    courts: ["Warangal District Court", "Hanamkonda Sessions Court", "Consumer Forum Warangal"],
    feeRange: "₹8,000–₹50,000 per case",
    avgConsultation: "₹500–₹2,000",
    faqs: [
      {
        q: "How much does a lawyer cost in Warangal?",
        a: "Advocate fees in Warangal are significantly lower than Hyderabad. Consultations cost ₹500–₹2,000, and full case representation in property or criminal matters ranges from ₹8,000 to ₹50,000. Land dispute cases involving agricultural land may require additional survey and revenue record fees.",
      },
      {
        q: "Which courts operate in Warangal?",
        a: "Warangal has the Warangal District Court, Sessions Court at Hanamkonda, Warangal Rural and Urban Magistrate Courts, Consumer Disputes Redressal Forum, and Labour Courts. The Telangana High Court in Hyderabad handles all appeals from Warangal district.",
      },
      {
        q: "What types of cases are most common in Warangal?",
        a: "Agricultural land disputes, tenancy and pattadar passbook-related matters, criminal cases at the Sessions Court, and property inheritance disputes are the most common in Warangal. Industrial disputes related to the Kazipet railway junction and textile sector also arise frequently.",
      },
      {
        q: "How can I find a property lawyer in Warangal?",
        a: "LitigaForge AI lists verified advocates in Warangal district filtered by practice area. For agricultural land disputes, you need an advocate familiar with Telangana land revenue records and the Dharani portal. Post your case requirement and receive proposals from matching advocates within 24 hours.",
      },
    ],
  },
  karimnagar: {
    name: "Karimnagar",
    district: "Karimnagar",
    state: "Telangana",
    courts: ["Karimnagar District Court", "Karimnagar Sessions Court", "Consumer Forum Karimnagar"],
    feeRange: "₹6,000–₹40,000 per case",
    avgConsultation: "₹400–₹1,500",
    faqs: [
      {
        q: "How much does a lawyer cost in Karimnagar?",
        a: "Legal fees in Karimnagar are among the most affordable in Telangana. Consultations cost ₹400–₹1,500 and case fees range from ₹6,000 to ₹40,000. For serious criminal matters or large property disputes, advocates may charge ₹50,000–₹1,00,000 for full representation including multiple hearings.",
      },
      {
        q: "Which courts operate in Karimnagar?",
        a: "Karimnagar has the District and Sessions Court complex on Jagtial Road, Magistrate Courts, Family Court, Consumer Disputes Redressal Forum, and Labour Court. Revenue Divisional Offices handle land record disputes. Appeals go to Telangana High Court, Hyderabad.",
      },
      {
        q: "What types of cases are most common in Karimnagar?",
        a: "Agricultural land and patta disputes dominate Karimnagar's courts, followed by criminal cases, family disputes, and matters related to the steel and handloom industries. SCCL (coal company) employee disputes and land acquisition cases near industrial zones are also common.",
      },
      {
        q: "Is there free legal aid available in Karimnagar?",
        a: "Yes. The Karimnagar District Legal Services Authority (DLSA) provides free legal aid to income-eligible persons (below ₹3 lakh/year), SC/ST citizens, women, and persons in custody. Contact DLSA Karimnagar at +91-878-2234567 or call the NALSA helpline 15100.",
      },
    ],
  },
  nizamabad: {
    name: "Nizamabad",
    district: "Nizamabad",
    state: "Telangana",
    courts: ["Nizamabad District Court", "Sessions Court Nizamabad", "Consumer Forum Nizamabad"],
    feeRange: "₹6,000–₹40,000 per case",
    avgConsultation: "₹400–₹1,500",
    faqs: [
      {
        q: "How much does a lawyer cost in Nizamabad?",
        a: "Legal fees in Nizamabad are affordable. Consultation charges are ₹400–₹1,500. Full representation in property or criminal cases typically costs ₹6,000–₹40,000. For complex matters involving cement industry land or Godavari basin water rights, specialist advocates may charge more.",
      },
      {
        q: "Which courts operate in Nizamabad?",
        a: "Nizamabad has the District and Sessions Court, various Civil Judge and Magistrate Courts, Family Court, Consumer Forum, and Revenue Division Offices. The Telangana High Court is the appellate authority for all Nizamabad district matters.",
      },
      {
        q: "What types of cases are most common in Nizamabad?",
        a: "Agricultural land disputes (paddy and sugarcane belt), rural tenancy matters, criminal cases related to border district issues, and family property disputes are the most common. Cases related to cement plant acquisitions near Adilabad and Nizamabad border also arise.",
      },
      {
        q: "How do I verify a lawyer's credentials in Nizamabad?",
        a: "All advocates must be enrolled with the Bar Council of Telangana. Ask for their enrollment number and verify on barcouncilofindia.org. LitigaForge AI verifies all listed advocates before they appear on the platform, giving you a pre-screened directory.",
      },
    ],
  },
  vijayawada: {
    name: "Vijayawada",
    district: "Krishna",
    state: "Andhra Pradesh",
    courts: ["Vijayawada District Court", "Krishna Sessions Court", "AP High Court (Amaravati)"],
    feeRange: "₹12,000–₹75,000 per case",
    avgConsultation: "₹800–₹3,000",
    faqs: [
      {
        q: "How much does a lawyer cost in Vijayawada?",
        a: "Advocate fees in Vijayawada (Krishna district) range from ₹800–₹3,000 for consultations and ₹12,000–₹75,000 for full case representation. Commercial and real estate lawyers near the Krishna River delta charge a premium due to high demand. AP High Court senior advocates charge ₹50,000+ per appearance.",
      },
      {
        q: "Which courts operate in Vijayawada?",
        a: "Vijayawada has the Krishna District Court, Sessions Court, City Civil Court, Consumer Disputes Redressal Commission, and the Commercial Court. The Andhra Pradesh High Court is located at Amaravati (30km away). RERA AP adjudicates property disputes across the state.",
      },
      {
        q: "What types of cases are most common in Vijayawada?",
        a: "Commercial disputes, property and land matters in the Krishna-Guntur corridor, banking recovery cases, family disputes, and construction/builder complaints are the most common in Vijayawada. As a major trade hub, cheque bounce cases under Section 138 NI Act are very frequent.",
      },
      {
        q: "How do RERA complaints work for AP property buyers in Vijayawada?",
        a: "Vijayawada falls under RERA AP jurisdiction. File complaints at rera.ap.gov.in. RERA AP must adjudicate within 60 days. For builders who haven't delivered on time or changed approved plans, you can seek a full refund with interest under Section 18 of RERA. An advocate who specialises in RERA AP matters will be most effective.",
      },
    ],
  },
  visakhapatnam: {
    name: "Visakhapatnam",
    district: "Visakhapatnam",
    state: "Andhra Pradesh",
    courts: ["Visakhapatnam District Court", "VIZAG Sessions Court", "Consumer Forum Vizag"],
    feeRange: "₹12,000–₹80,000 per case",
    avgConsultation: "₹800–₹3,500",
    faqs: [
      {
        q: "How much does a lawyer cost in Visakhapatnam?",
        a: "Legal fees in Visakhapatnam (Vizag) range from ₹800–₹3,500 for consultations and ₹12,000–₹80,000 for representation. Maritime and admiralty law specialists near the Visakhapatnam Port Trust area command higher fees. Industrial dispute lawyers near RINL Vizag Steel also charge a premium.",
      },
      {
        q: "Which courts operate in Visakhapatnam?",
        a: "Vizag has the District and Sessions Court complex, City Civil Court, Family Court, Consumer Disputes Redressal Commission, Labour Court, and specialised RINL and port-related tribunals. The AP High Court in Amaravati handles appeals. The Admiralty jurisdiction covers maritime disputes at Vizag Port.",
      },
      {
        q: "What types of cases are most common in Visakhapatnam?",
        a: "Industrial and labour disputes (RINL, HPCL, BHPV), property matters in beach-corridor areas, maritime and port-related cases, family disputes, and environmental litigation related to the GVMC and industrial zones are most common. Tourism-related consumer complaints also arise frequently.",
      },
      {
        q: "Where can I find a maritime lawyer in Visakhapatnam?",
        a: "Vizag is one of the few cities in AP with advocates practising admiralty and maritime law due to the Visakhapatnam Port Trust's presence. Use LitigaForge AI to filter by practice area. Post your requirement with 'maritime' or 'admiralty' in the case description to reach specialists.",
      },
    ],
  },
  guntur: {
    name: "Guntur",
    district: "Guntur",
    state: "Andhra Pradesh",
    courts: ["Guntur District Court", "Guntur Sessions Court", "Consumer Forum Guntur"],
    feeRange: "₹8,000–₹50,000 per case",
    avgConsultation: "₹500–₹2,000",
    faqs: [
      {
        q: "How much does a lawyer cost in Guntur?",
        a: "Legal fees in Guntur are moderate. Consultations cost ₹500–₹2,000, and full representation ranges from ₹8,000–₹50,000. Agricultural land and revenue matters — very common in the Guntur delta — are typically handled at ₹10,000–₹30,000. Civil suits for large land parcels may cost more.",
      },
      {
        q: "Which courts operate in Guntur?",
        a: "Guntur has the District and Sessions Court, Civil Judge Courts, Family Court, Consumer Disputes Redressal Commission, Labour Court, and Revenue Division Offices. RERA AP handles property disputes. Appeals go to the AP High Court in Amaravati (30km from Guntur).",
      },
      {
        q: "What types of cases are most common in Guntur?",
        a: "Agricultural land disputes in the tobacco and paddy belt, property inheritance matters in joint families, criminal cases, tenancy disputes, and cheque bounce cases under Section 138 NI Act are most common. Consumer cases against fertilizer and agri-input companies also arise frequently.",
      },
      {
        q: "How close is Guntur to the AP High Court?",
        a: "The AP High Court is located in Amaravati, approximately 30km from Guntur. This makes Guntur advocates particularly well-placed for High Court practice. Many Guntur-based advocates regularly appear at the AP High Court, making them a cost-effective alternative to Vijayawada advocates for AP HC matters.",
      },
    ],
  },
  tirupati: {
    name: "Tirupati",
    district: "Chittoor",
    state: "Andhra Pradesh",
    courts: ["Tirupati District Court", "Chittoor Sessions Court", "Consumer Forum Tirupati"],
    feeRange: "₹8,000–₹50,000 per case",
    avgConsultation: "₹500–₹2,000",
    faqs: [
      {
        q: "How much does a lawyer cost in Tirupati?",
        a: "Advocate fees in Tirupati (Chittoor district) are affordable. Consultations cost ₹500–₹2,000, and case fees range from ₹8,000 to ₹50,000. Property disputes near the Tirumala hills and TTD land cases may involve more complex revenue law and require specialist advocates who charge a premium.",
      },
      {
        q: "Which courts operate in Tirupati?",
        a: "Tirupati has the District and Sessions Court for Chittoor, Magistrate Courts, Family Court, Consumer Disputes Redressal Commission, and the TTD (Tirumala Tirupati Devasthanam) administrative court for trust-related matters. AP High Court in Amaravati is the appellate authority.",
      },
      {
        q: "What types of cases are most common in Tirupati?",
        a: "Land disputes near TTD-controlled areas, religious endowment property matters (AP Charitable and Hindu Religious Institutions Act), pilgrim-related consumer complaints, property inheritance cases, and criminal matters are most common. Tourism and hospitality sector disputes are also on the rise.",
      },
      {
        q: "Are there advocates in Tirupati who handle TTD land disputes?",
        a: "Yes. Some Tirupati-based advocates specialise in cases involving TTD land acquisition, temple property disputes, and the AP Charitable and Hindu Religious Institutions and Endowments Act. When posting your case on LitigaForge AI, mention 'TTD land' or 'religious endowment' in your case description to attract these specialists.",
      },
    ],
  },
};

const ALL_CITIES = Object.entries(CITIES).map(([slug, data]) => ({ slug, name: data.name }));

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface Lawyer {
  id: number;
  name: string;
  district: string;
  practice_areas: string[];
  languages: string[];
  experience_years: number;
  rating: number;
  hourly_rate: number;
  availability: string;
  verified: boolean;
  bio: string;
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function LawyerCard({ lawyer, i }: { lawyer: Lawyer; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.06 }}
      className="bg-card border border-border rounded-2xl p-5 hover:shadow-md hover:border-primary/30 transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm flex-shrink-0">
            {lawyer.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-foreground text-sm">{lawyer.name}</span>
              {lawyer.verified && (
                <BadgeCheck className="w-4 h-4 text-primary flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <MapPin className="w-3 h-3" />
              {lawyer.district}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {lawyer.rating > 0 && (
            <div className="flex items-center gap-1 text-xs font-semibold text-amber-600">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
              {lawyer.rating.toFixed(1)}
            </div>
          )}
          {lawyer.hourly_rate > 0 && (
            <span className="text-xs text-muted-foreground">₹{lawyer.hourly_rate.toLocaleString("en-IN")}/hr</span>
          )}
        </div>
      </div>

      {lawyer.practice_areas?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {lawyer.practice_areas.slice(0, 4).map(area => (
            <span key={area} className="px-2 py-0.5 bg-primary/8 text-primary rounded-full text-xs font-medium border border-primary/15">
              {area}
            </span>
          ))}
        </div>
      )}

      {lawyer.bio && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{lawyer.bio}</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {lawyer.experience_years > 0 && (
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{lawyer.experience_years}yr exp</span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            lawyer.availability === "available"
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-700"
          }`}>
            {lawyer.availability === "available" ? "Available" : "Busy"}
          </span>
        </div>
        <Link href="/post-case">
          <button className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
            Contact <ArrowRight className="w-3 h-3" />
          </button>
        </Link>
      </div>
    </motion.div>
  );
}

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left bg-card hover:bg-muted/50 transition-colors"
      >
        <span className="font-semibold text-foreground text-sm">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-5 py-4 text-sm text-muted-foreground leading-relaxed border-t border-border bg-card">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */

export default function CityPage() {
  const { city } = useParams<{ city: string }>();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const cityData = city ? CITIES[city.toLowerCase()] : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["lawyers-city", cityData?.district],
    enabled: !!cityData,
    queryFn: async () => {
      const params = new URLSearchParams({ district: cityData!.district });
      const res = await apiFetch(`/lawyers?${params}`);
      const json = await res.json();
      return json as { lawyers: Lawyer[]; total: number };
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!cityData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
        <Scale className="w-12 h-12 text-muted-foreground/40" />
        <h1 className="text-2xl font-bold text-foreground">City Not Found</h1>
        <p className="text-muted-foreground">
          We don't have a page for this city yet.
        </p>
        <Link href="/lawyers">
          <button className="flex items-center gap-2 text-primary font-semibold hover:underline">
            Browse all lawyers <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
      </div>
    );
  }

  const siteUrl = "https://litiga-forge-ai.replit.app";
  const pageUrl = `${siteUrl}/lawyers/${city}`;
  const lawyers = data?.lawyers ?? [];
  const otherCities = ALL_CITIES.filter(c => c.slug !== city);

  return (
    <>
      <SEOHelmet
        title={`Best Lawyers in ${cityData.name} | LitigaForge AI`}
        description={`Connect with verified advocates in ${cityData.name}. AI-powered matching for property, criminal, family & civil cases. Free to post your case. ${cityData.state}.`}
        canonical={`/lawyers/${city}`}
        keywords={`lawyer ${cityData.name}, advocate ${cityData.name}, best lawyer ${cityData.name}, verified advocate ${cityData.name}, ${cityData.state} lawyer`}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "LegalService",
          "name": `LitigaForge AI — Lawyers in ${cityData.name}`,
          "description": `Find verified advocates in ${cityData.name}, ${cityData.state}. AI-powered matching for all legal matters.`,
          "url": pageUrl,
          "areaServed": {
            "@type": "City",
            "name": cityData.name,
            "containedInPlace": {
              "@type": "State",
              "name": cityData.state,
            },
          },
          "hasOfferCatalog": {
            "@type": "OfferCatalog",
            "name": "Legal Services",
            "itemListElement": [
              { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Property Law" } },
              { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Criminal Law" } },
              { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Family Law" } },
              { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Consumer Law" } },
            ],
          },
          "mainEntity": {
            "@type": "FAQPage",
            "mainEntity": cityData.faqs.map(f => ({
              "@type": "Question",
              "name": f.q,
              "acceptedAnswer": { "@type": "Answer", "text": f.a },
            })),
          },
        }}
      />

      <div className="min-h-screen bg-background">

        {/* Hero */}
        <div className="bg-gradient-to-br from-primary/6 via-background to-background border-b border-border">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Link href="/lawyers"><span className="hover:text-primary cursor-pointer transition-colors">All Lawyers</span></Link>
              <span>/</span>
              <span className="text-foreground">{cityData.name}</span>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-semibold text-primary uppercase tracking-widest">{cityData.state}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
              Find Verified Lawyers in {cityData.name}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mb-6">
              AI-powered matching connects you with verified advocates in {cityData.name} for property, criminal, family, and civil matters — free to post, no commitment.
            </p>

            {/* Trust strip */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><BadgeCheck className="w-4 h-4 text-primary" /> Bar Council verified</span>
              <span className="flex items-center gap-1.5"><Scale className="w-4 h-4 text-primary" /> AI match score (0–100)</span>
              <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4 text-primary" />{cityData.courts[0]}</span>
              <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-primary" />Avg. fee: {cityData.avgConsultation}</span>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Left: Lawyers list */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-foreground">
                  {isLoading ? "Loading advocates…" : `${lawyers.length > 0 ? lawyers.length : "No"} verified advocate${lawyers.length !== 1 ? "s" : ""} in ${cityData.name}`}
                </h2>
                <Link href="/lawyers">
                  <button className="text-xs text-primary hover:underline font-medium">View all →</button>
                </Link>
              </div>

              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
                      <div className="flex gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-muted" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded w-1/3" />
                          <div className="h-3 bg-muted rounded w-1/4" />
                        </div>
                      </div>
                      <div className="h-3 bg-muted rounded w-full mb-2" />
                      <div className="h-3 bg-muted rounded w-2/3" />
                    </div>
                  ))}
                </div>
              ) : lawyers.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-8 text-center">
                  <Scale className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="font-semibold text-foreground mb-1">No advocates listed yet in {cityData.name}</p>
                  <p className="text-sm text-muted-foreground mb-5">
                    Post your case and receive proposals from matching advocates across {cityData.state}.
                  </p>
                  <Link href="/post-case">
                    <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
                      Post Your Case <ArrowRight className="w-4 h-4" />
                    </button>
                  </Link>
                </div>
              ) : (
                lawyers.map((lawyer, i) => <LawyerCard key={lawyer.id} lawyer={lawyer} i={i} />)
              )}

              {lawyers.length > 0 && (
                <div className="bg-gradient-to-br from-primary/8 to-primary/3 border border-primary/20 rounded-2xl p-6 text-center mt-4">
                  <h3 className="font-bold text-foreground mb-1">Don't see the right advocate?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Post your case and let AI match you with the best-fit advocates in {cityData.name} and nearby districts.
                  </p>
                  <Link href="/post-case">
                    <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
                      Post Your Case Free <ArrowRight className="w-4 h-4" />
                    </button>
                  </Link>
                </div>
              )}
            </div>

            {/* Right: Courts + other cities */}
            <div className="space-y-6">
              {/* Courts */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" /> Courts in {cityData.name}
                </h3>
                <ul className="space-y-2">
                  {cityData.courts.map(court => (
                    <li key={court} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      {court}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Fee guide */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-primary" /> Fee Guide
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Consultation</span>
                    <span className="font-medium text-foreground">{cityData.avgConsultation}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Full case</span>
                    <span className="font-medium text-foreground">{cityData.feeRange}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Free legal aid</span>
                    <span className="font-medium text-green-600">NALSA: 15100</span>
                  </div>
                </div>
              </div>

              {/* Other cities */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" /> Lawyers in Other Cities
                </h3>
                <div className="space-y-1">
                  {otherCities.map(c => (
                    <Link key={c.slug} href={`/lawyers/${c.slug}`}>
                      <div className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-muted transition-colors cursor-pointer group">
                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{c.name}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">
              Frequently Asked Questions — Lawyers in {cityData.name}
            </h2>
            <div className="space-y-3">
              {cityData.faqs.map((faq, i) => (
                <FaqItem
                  key={i}
                  q={faq.q}
                  a={faq.a}
                  open={openFaq === i}
                  onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                />
              ))}
            </div>
          </div>

          {/* Internal links footer */}
          <div className="mt-12 border-t border-border pt-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-4">
              Find Lawyers in Other Cities
            </h3>
            <div className="flex flex-wrap gap-2">
              {otherCities.map(c => (
                <Link key={c.slug} href={`/lawyers/${c.slug}`}>
                  <span className="px-3 py-1.5 bg-muted hover:bg-primary/10 hover:text-primary border border-border rounded-full text-sm text-muted-foreground transition-colors cursor-pointer">
                    Lawyers in {c.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="mt-10">
            <div className="bg-gradient-to-br from-primary/8 to-primary/3 border border-primary/20 rounded-2xl p-8 text-center">
              <h2 className="text-xl font-bold text-foreground mb-2">
                Need a Lawyer in {cityData.name}?
              </h2>
              <p className="text-muted-foreground text-sm mb-5 max-w-lg mx-auto">
                Post your case for free. LitigaForge AI scores and ranks verified advocates in {cityData.name} by practice area, experience, and rating — you pick the best fit.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/post-case">
                  <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors">
                    Post Your Case Free <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
                <Link href="/ask">
                  <button className="inline-flex items-center gap-2 border border-border bg-background px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-muted transition-colors">
                    Ask AI a Legal Question
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
