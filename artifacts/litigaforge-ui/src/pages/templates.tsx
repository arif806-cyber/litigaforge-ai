import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { LayoutTemplate, Search, ChevronRight, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const TEMPLATES = [
  // Criminal
  { id: "cheque_bounce_notice",    title: "Cheque Bounce Legal Notice", law: "NI Act S.138",        category: "Criminal",  desc: "Statutory demand notice before filing complaint for dishonoured cheque.", fields: ["drawer_name","payee_name","cheque_no","amount","bank","date_of_dishonour"] },
  { id: "bail_application",        title: "Bail Application",            law: "CrPC S.437",          category: "Criminal",  desc: "Regular bail application before Magistrate for bailable/non-bailable offence.", fields: ["accused_name","offence","fir_no","police_station","grounds"] },
  { id: "anticipatory_bail",       title: "Anticipatory Bail",           law: "CrPC S.438",          category: "Criminal",  desc: "Pre-arrest bail from Sessions Court or High Court.", fields: ["applicant_name","anticipated_offence","grounds","state"] },
  { id: "criminal_complaint",      title: "Criminal Complaint / FIR",   law: "CrPC S.154/200",       category: "Criminal",  desc: "Complaint to Magistrate or police for cognizable offence.", fields: ["complainant","accused","offence_details","date_of_offence","witnesses"] },
  { id: "revision_petition",       title: "Revision Petition",           law: "CrPC S.397",          category: "Criminal",  desc: "Revision against order of subordinate criminal court.", fields: ["petitioner","respondent","order_challenged","grounds"] },

  // Civil
  { id: "rent_eviction",           title: "Rent Eviction Notice",        law: "TS Buildings (Rent) Act", category: "Civil",  desc: "Legal notice for eviction due to rent arrears or illegal occupation.", fields: ["landlord","tenant","property_address","rent_amount","arrears","notice_period"] },
  { id: "money_recovery",          title: "Money Recovery Suit",         law: "CPC Order 37",        category: "Civil",    desc: "Summary suit for recovery of money on a written contract.", fields: ["plaintiff","defendant","amount","interest_rate","date_of_contract"] },
  { id: "injunction",              title: "Injunction Application",      law: "CPC Order 39 R.1-2",  category: "Civil",    desc: "Interim injunction to restrain defendant from specific act.", fields: ["plaintiff","defendant","relief_sought","grounds_urgency"] },
  { id: "property_plaint",         title: "Property Dispute Plaint",     law: "CPC S.26 / Order 7",  category: "Civil",    desc: "Suit for declaration, possession, or partition of property.", fields: ["plaintiff","defendant","property_description","relief","valuation"] },
  { id: "appeal_memo",             title: "Appeal Memo",                  law: "CPC S.96 / CrPC S.374", category: "Civil", desc: "Memorandum of appeal against decree or judgment.", fields: ["appellant","respondent","lower_court","judgment_date","grounds"] },
  { id: "legal_notice_general",    title: "Legal Notice (General)",      law: "Limitation Act",      category: "Civil",    desc: "Formal legal notice for any civil demand or dispute.", fields: ["sender","recipient","subject","demand","deadline"] },

  // Consumer
  { id: "consumer_complaint",      title: "Consumer Complaint",          law: "COPRA 2019",          category: "Consumer", desc: "Complaint before District/State Consumer Commission for defective goods or deficient service.", fields: ["complainant","opposite_party","goods_service","defect","relief_amount"] },
  { id: "insurance_complaint",     title: "Insurance Claim Complaint",   law: "IRDAI Act",           category: "Consumer", desc: "Complaint against insurance company for wrongful claim rejection.", fields: ["complainant","insurer","policy_no","claim_amount","grounds"] },
  { id: "ecommerce_refund",        title: "E-Commerce Refund Complaint", law: "COPRA 2019 / IT Act",  category: "Consumer", desc: "Complaint against online platform for refund or return dispute.", fields: ["complainant","platform","order_id","amount","issue"] },

  // Family
  { id: "divorce_petition",        title: "Divorce Petition",            law: "HMA S.13",            category: "Family",   desc: "Petition for divorce on grounds of cruelty, desertion, or adultery.", fields: ["petitioner","respondent","marriage_date","grounds","children"] },
  { id: "maintenance_application", title: "Maintenance Application",     law: "HMA S.24 / CrPC S.125", category: "Family", desc: "Application for interim or permanent maintenance.", fields: ["applicant","respondent","income_details","expenses","amount_claimed"] },
  { id: "child_custody",           title: "Child Custody Petition",      law: "Guardians & Wards Act 1890", category: "Family", desc: "Petition for custody and guardianship of minor child.", fields: ["petitioner","child_name","child_age","grounds","access_terms"] },

  // Corporate / Tax
  { id: "gst_dispute_reply",       title: "GST Dispute Reply",           law: "CGST Act 2017",       category: "Tax",      desc: "Reply to Show Cause Notice from GST authority.", fields: ["assessee","gstin","notice_no","notice_date","grounds_of_reply"] },
  { id: "income_tax_appeal",       title: "Income Tax Appeal",           law: "IT Act S.246A",       category: "Tax",      desc: "Appeal before CIT(A) against assessment order.", fields: ["appellant","pan","assessment_year","demand_amount","grounds"] },
  { id: "nclt_insolvency",         title: "NCLT Insolvency Petition",    law: "IBC 2016 S.7/9",      category: "Corporate", desc: "Petition by financial creditor or operational creditor under IBC.", fields: ["applicant_type","debtor","debt_amount","default_date","creditor_details"] },
  { id: "company_petition",        title: "Company Law Petition",        law: "Companies Act 2013",  category: "Corporate", desc: "Petition for oppression, mismanagement, or winding up.", fields: ["petitioner","company","cin","grounds","relief"] },

  // Property
  { id: "sale_agreement",          title: "Property Sale Agreement",     law: "Transfer of Property Act", category: "Property", desc: "Agreement for sale/purchase of immovable property.", fields: ["seller","buyer","property_address","consideration","possession_date"] },
  { id: "power_of_attorney",       title: "Power of Attorney (General)", law: "Powers of Attorney Act 1882", category: "Property", desc: "Authorising agent to act on principal's behalf for property matters.", fields: ["principal","agent","purpose","duration","property_details"] },
  { id: "leave_license",           title: "Leave & License Agreement",   law: "Maharashtra Rent Act / TN Act", category: "Property", desc: "Agreement for temporary licensed occupation of premises.", fields: ["licensor","licensee","premises","monthly_compensation","duration"] },
  { id: "partnership_deed",        title: "Partnership Deed",            law: "Indian Partnership Act 1932", category: "Property", desc: "Deed constituting a partnership firm.", fields: ["partners","firm_name","business","capital","profit_ratio"] },

  // Other
  { id: "rti_application",         title: "RTI Application",             law: "RTI Act 2005 S.6",    category: "Other",    desc: "Application for information from public authority.", fields: ["applicant","public_authority","information_sought","bpl_status"] },
  { id: "vakalathnama",            title: "Vakalathnama",                law: "Advocates Act 1961",  category: "Other",    desc: "Power to plead given to advocate in a court matter.", fields: ["client","advocate","court","case_type","parties"] },
  { id: "writ_petition",           title: "Writ Petition",              law: "Art. 226 / 32 Const.", category: "Other",    desc: "Petition before High Court / Supreme Court for enforcement of fundamental rights.", fields: ["petitioner","respondent","writ_type","grounds","relief"] },
  { id: "mact_petition",           title: "Motor Accident Claim",        law: "MV Act 1988 S.166",   category: "Other",    desc: "Claim petition before Motor Accidents Claims Tribunal.", fields: ["claimant","victim","vehicle_no","accident_date","injuries","compensation"] },
];

const CATEGORIES = ["All", "Criminal", "Civil", "Consumer", "Family", "Corporate", "Tax", "Property", "Other"];

const CATEGORY_COLORS: Record<string, string> = {
  Criminal: "bg-red-50 text-red-700 border-red-200",
  Civil: "bg-blue-50 text-blue-700 border-blue-200",
  Consumer: "bg-green-50 text-green-700 border-green-200",
  Family: "bg-pink-50 text-pink-700 border-pink-200",
  Corporate: "bg-purple-50 text-purple-700 border-purple-200",
  Tax: "bg-amber-50 text-amber-700 border-amber-200",
  Property: "bg-teal-50 text-teal-700 border-teal-200",
  Other: "bg-gray-50 text-gray-700 border-gray-200",
};

export default function Templates() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const filtered = TEMPLATES.filter(t =>
    (category === "All" || t.category === category) &&
    (search === "" || t.title.toLowerCase().includes(search.toLowerCase()) || t.law.toLowerCase().includes(search.toLowerCase()) || t.desc.toLowerCase().includes(search.toLowerCase()))
  );

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="h-full overflow-auto px-4 pb-10 md:px-10 pt-6 md:pt-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <LayoutTemplate className="w-6 h-6 text-emerald-600" /> Template Library
            </h1>
            <p className="text-sm text-gray-500 mt-1">{TEMPLATES.length} Indian legal document templates — click to draft with AI</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search templates or law..."
              className="pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 w-full md:w-72"
            />
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                category === cat
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              )}
            >
              {cat}
              {cat !== "All" && <span className="ml-1 opacity-60">({TEMPLATES.filter(t => t.category === cat).length})</span>}
            </button>
          ))}
        </div>

        {/* Template grid */}
        <motion.div variants={container} initial="hidden" animate="show" className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => (
            <motion.div key={t.id} variants={item}>
              <button
                onClick={() => setLocation(`/draft?template=${t.id}`)}
                className="w-full text-left bg-white border border-gray-200 rounded-2xl p-5 hover:border-primary/40 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm group-hover:text-primary transition-colors leading-snug">{t.title}</p>
                    <p className="text-[11px] text-gray-400 font-mono mt-0.5">{t.law}</p>
                  </div>
                  <span className={cn("flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-medium", CATEGORY_COLORS[t.category])}>
                    {t.category}
                  </span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed mb-3">{t.desc}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {t.fields.slice(0, 3).map(f => (
                    <span key={f} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-mono">{f.replace(/_/g, " ")}</span>
                  ))}
                  {t.fields.length > 3 && <span className="text-[10px] text-gray-400">+{t.fields.length - 3} more</span>}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Draft with AI <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </button>
            </motion.div>
          ))}
        </motion.div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">No templates match your search</p>
            <button onClick={() => { setSearch(""); setCategory("All"); }} className="mt-2 text-xs text-primary hover:underline">Clear filters</button>
          </div>
        )}
      </div>
    </div>
  );
}
