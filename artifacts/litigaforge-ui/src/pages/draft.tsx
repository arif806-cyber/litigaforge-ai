import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { PenTool, Loader2, Copy, Check, ChevronDown, LayoutTemplate, AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

const TEMPLATES: Record<string, { title: string; law: string; category: string; fields: { id: string; label: string; placeholder: string; type?: string }[] }> = {
  cheque_bounce_notice: {
    title: "Cheque Bounce Legal Notice", law: "NI Act S.138", category: "Criminal",
    fields: [
      { id: "drawer_name", label: "Drawer (Cheque Issuer)", placeholder: "Rajesh Kumar Sharma" },
      { id: "payee_name", label: "Payee (Your Client)", placeholder: "Adv. Suresh Reddy" },
      { id: "cheque_no", label: "Cheque Number", placeholder: "000123" },
      { id: "amount", label: "Cheque Amount (₹)", placeholder: "5,00,000", type: "text" },
      { id: "bank", label: "Drawee Bank & Branch", placeholder: "SBI, Ameerpet Branch, Hyderabad" },
      { id: "date_of_dishonour", label: "Date of Dishonour", placeholder: "15-05-2025", type: "text" },
      { id: "advocate_name", label: "Your Name (Advocate)", placeholder: "Adv. Ramesh Kumar" },
    ],
  },
  bail_application: {
    title: "Bail Application", law: "CrPC S.437", category: "Criminal",
    fields: [
      { id: "accused_name", label: "Accused Name", placeholder: "Mohammed Ali Khan" },
      { id: "offence", label: "Offence / IPC Sections", placeholder: "IPC S.420, 406 — Cheating & Criminal Breach of Trust" },
      { id: "fir_no", label: "FIR Number", placeholder: "FIR No. 234/2025" },
      { id: "police_station", label: "Police Station", placeholder: "Banjara Hills PS, Hyderabad" },
      { id: "grounds", label: "Grounds for Bail", placeholder: "Accused has permanent roots in society, no flight risk, cooperative with investigation..." },
      { id: "surety_offered", label: "Surety / Bond Offered", placeholder: "Two sureties of ₹1,00,000 each" },
    ],
  },
  consumer_complaint: {
    title: "Consumer Complaint", law: "COPRA 2019", category: "Consumer",
    fields: [
      { id: "complainant", label: "Complainant (Your Client)", placeholder: "Priya Venkatesh" },
      { id: "opposite_party", label: "Opposite Party (Company/Service Provider)", placeholder: "M/s XYZ Electronics Pvt. Ltd., Hyderabad" },
      { id: "goods_service", label: "Goods / Service Purchased", placeholder: "Samsung Galaxy S25 Ultra, Invoice No. INV-0012" },
      { id: "defect", label: "Defect / Deficiency in Service", placeholder: "Display stopped working within 30 days of purchase, company refused warranty repair..." },
      { id: "relief_amount", label: "Compensation Claimed (₹)", placeholder: "1,50,000" },
      { id: "date_of_purchase", label: "Date of Purchase / Service", placeholder: "01-04-2025" },
    ],
  },
  rent_eviction: {
    title: "Rent Eviction Notice", law: "TS Buildings (Rent) Act", category: "Civil",
    fields: [
      { id: "landlord", label: "Landlord / Licensor Name", placeholder: "Dr. Venkat Rao Sharma" },
      { id: "tenant", label: "Tenant / Licensee Name", placeholder: "Suresh Babu Reddy" },
      { id: "property_address", label: "Property Address", placeholder: "H.No. 8-2-293/A, Road No. 78, Jubilee Hills, Hyderabad - 500033" },
      { id: "rent_amount", label: "Monthly Rent (₹)", placeholder: "25,000" },
      { id: "arrears", label: "Arrears / Breach Description", placeholder: "Rent not paid for 6 months (Nov 2024 – Apr 2025); total arrears ₹1,50,000" },
      { id: "notice_period", label: "Notice Period Given", placeholder: "30 days from date of receipt" },
    ],
  },
  writ_petition: {
    title: "Writ Petition", law: "Art. 226 Constitution", category: "Other",
    fields: [
      { id: "petitioner", label: "Petitioner Name", placeholder: "Lakshmi Narayana, S/o Ramaiah" },
      { id: "respondent", label: "Respondent (Government / Authority)", placeholder: "The State of Telangana through its Principal Secretary, Home Department" },
      { id: "writ_type", label: "Writ Type", placeholder: "Mandamus / Certiorari / Prohibition / Habeas Corpus / Quo Warranto" },
      { id: "grounds", label: "Grounds for the Writ", placeholder: "Denial of natural justice, arbitrary action, violation of Art. 14, 19, 21..." },
      { id: "relief", label: "Relief Sought", placeholder: "Issue a writ of mandamus directing respondent to..." },
      { id: "urgency", label: "Urgency / Reason for Interim Relief", placeholder: "Petitioner faces immediate irreparable harm because..." },
    ],
  },
  rti_application: {
    title: "RTI Application", law: "RTI Act 2005 S.6", category: "Other",
    fields: [
      { id: "applicant", label: "Applicant Name & Address", placeholder: "Ravi Shankar, Flat 4B, Sunshine Apartments, Secunderabad - 500003" },
      { id: "public_authority", label: "Public Authority (PIO Name & Office)", placeholder: "The Public Information Officer, Telangana State Housing Corporation, Hyderabad" },
      { id: "information_sought", label: "Information Sought (be specific)", placeholder: "1. Copy of allotment order for Plot No. 123, Survey No. 456...\n2. Status of pending application dated..." },
      { id: "period", label: "Period of Information", placeholder: "2020 to 2025" },
    ],
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  Criminal: "text-red-600 bg-red-50 border-red-200",
  Civil: "text-blue-600 bg-blue-50 border-blue-200",
  Consumer: "text-green-600 bg-green-50 border-green-200",
  Other: "text-gray-600 bg-gray-50 border-gray-200",
  Family: "text-pink-600 bg-pink-50 border-pink-200",
};

export default function Draft() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialTemplate = searchParams.get("template") ?? "cheque_bounce_notice";

  const [templateId, setTemplateId] = useState(initialTemplate);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [customInstructions, setCustomInstructions] = useState("");
  const [draftText, setDraftText] = useState("");
  const [copied, setCopied] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  const template = TEMPLATES[templateId] ?? TEMPLATES.cheque_bounce_notice;

  useEffect(() => {
    setVariables({});
    setDraftText("");
  }, [templateId]);

  const draftMutation = useMutation({
    mutationFn: () =>
      apiFetch("/draft", {
        method: "POST",
        body: JSON.stringify({ template_id: templateId, variables, custom_instructions: customInstructions }),
      }),
    onSuccess: (data: { draft: string }) => setDraftText(data.draft),
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(draftText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const allFilled = template.fields.every(f => variables[f.id]?.trim());

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-5 md:px-10 md:py-6 flex-shrink-0 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <PenTool className="w-6 h-6 text-violet-600" /> AI Legal Drafting
        </h1>
        <p className="text-sm text-gray-500 mt-1">Fill in the details — AI generates a court-ready legal document in seconds</p>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-0">

        {/* Left panel: form */}
        <div className="lg:w-96 xl:w-[420px] flex-shrink-0 border-r border-gray-100 flex flex-col overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex-shrink-0">
            {/* Template selector */}
            <div className="relative">
              <button
                onClick={() => setShowTemplateMenu(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <LayoutTemplate className="w-4 h-4 text-violet-500 flex-shrink-0" />
                  <span className="font-medium text-gray-900 truncate">{template.title}</span>
                  <span className={cn("flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-medium", CATEGORY_COLORS[template.category] ?? "text-gray-600 bg-gray-50 border-gray-200")}>
                    {template.category}
                  </span>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-gray-400 flex-shrink-0 transition-transform", showTemplateMenu && "rotate-180")} />
              </button>
              <AnimatePresence>
                {showTemplateMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-56 overflow-y-auto"
                  >
                    {Object.entries(TEMPLATES).map(([id, tmpl]) => (
                      <button
                        key={id}
                        onClick={() => { setTemplateId(id); setShowTemplateMenu(false); }}
                        className={cn("w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm transition-colors", templateId === id && "bg-primary/5 text-primary font-medium")}
                      >
                        <p className="font-medium text-gray-900 text-xs">{tmpl.title}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{tmpl.law}</p>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Form fields */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">{template.law}</p>
            {template.fields.map(field => (
              <div key={field.id}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{field.label}</label>
                {field.placeholder.includes("\n") ? (
                  <textarea
                    value={variables[field.id] ?? ""}
                    onChange={e => setVariables(v => ({ ...v, [field.id]: e.target.value }))}
                    placeholder={field.placeholder}
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                ) : (
                  <input
                    type={field.type ?? "text"}
                    value={variables[field.id] ?? ""}
                    onChange={e => setVariables(v => ({ ...v, [field.id]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                )}
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Additional Instructions (optional)</label>
              <textarea
                value={customInstructions}
                onChange={e => setCustomInstructions(e.target.value)}
                placeholder="Any special instructions, tone, or additional facts the AI should include..."
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            <button
              onClick={() => draftMutation.mutate()}
              disabled={draftMutation.isPending || !allFilled}
              className="w-full h-11 rounded-xl bg-violet-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
            >
              {draftMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenTool className="w-4 h-4" />}
              {draftMutation.isPending ? "Drafting with AI…" : "Generate Document"}
            </button>

            {draftMutation.isError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {String(draftMutation.error)}
              </div>
            )}
          </div>
        </div>

        {/* Right panel: output */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">
          <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0 bg-white">
            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">Generated Document</p>
            {draftText && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-medium text-gray-700 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
            {draftMutation.isPending ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
                <p className="text-sm">AI is drafting your legal document…</p>
              </div>
            ) : draftText ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
                <pre className="whitespace-pre-wrap font-serif text-sm text-gray-800 leading-relaxed">{draftText}</pre>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <PenTool className="w-12 h-12 text-gray-200" />
                <p className="text-gray-400 font-medium">Fill in the fields and click Generate</p>
                <p className="text-xs text-gray-300 max-w-xs">The AI will draft a court-ready legal document based on Indian law, citing relevant sections and precedents</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
