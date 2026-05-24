import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useParams, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Loader2, Download, Copy, CheckCircle2, FileText,
  AlertTriangle, Sparkles, Printer, Share2, Home, Mail,
  FileKey, FileCheck, Shield, Scroll, MessageCircleWarning,
  UserMinus, Receipt, Building2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/PageShell";

const ICON_MAP: Record<string, React.ElementType> = {
  Home, Mail, FileKey, FileCheck, Shield, Scroll,
  MessageCircleWarning, UserMinus, Receipt, Building2, FileText,
};

interface TemplateField {
  name: string;
  label: string;
  type: string;
  placeholder: string;
  required: boolean;
  options: string[];
  help_text: string;
}

interface TemplateDetail {
  slug: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  estimated_time: string;
  fields: TemplateField[];
}

export default function DocumentTemplatePage() {
  const { slug } = useParams();
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [generated, setGenerated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: template, isLoading } = useQuery<TemplateDetail>({
    queryKey: ["document-template", slug],
    queryFn: () => apiFetch(`/documents/free/templates/${slug}`),
    enabled: !!slug,
  });

  const generateMutation = useMutation({
    mutationFn: () => apiFetch("/documents/free/generate", {
      method: "POST",
      body: JSON.stringify({ slug, fields: fieldValues }),
    }),
    onSuccess: (data) => setGenerated(data.document_text),
  });

  const Icon = template ? ICON_MAP[template.icon] || FileText : FileText;

  const allRequiredFilled = template?.fields
    .filter(f => f.required)
    .every(f => fieldValues[f.name]?.trim()) ?? false;

  const handleDownload = () => {
    if (!generated) return;
    const blob = new Blob([generated], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug?.replace(/-/g, "_")}_document.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    if (!generated) return;
    await navigator.clipboard.writeText(generated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!generated) return;
    const text = `Legal Document: ${template?.title}\n\n${generated.slice(0, 300)}...\n\nGenerated via LitigaForge AI`;
    if (navigator.share) {
      await navigator.share({ title: template?.title || "Legal Document", text });
    } else {
      const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(wa, "_blank");
    }
  };

  const handlePrint = () => {
    if (!generated) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<pre style="font-family:serif;white-space:pre-wrap;padding:40px;line-height:1.6;font-size:14px">${generated.replace(/</g, "&lt;")}</pre>`);
    w.document.close();
    w.print();
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Template Not Found</h2>
        <p className="text-muted-foreground mb-6">The document template you are looking for does not exist.</p>
        <Link href="/free-documents">
          <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Templates</Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <SEOHelmet
        title={`${template.title} — Free Legal Document`}
        description={`Generate a free ${template.title.toLowerCase()} in minutes. Fill the form, AI drafts it, download instantly.`}
        canonical={`/free-documents/${slug}`}
      />
      <PageShell title={template.title} subtitle={template.description} icon={<Icon className="w-6 h-6 text-primary" />}>
        <div className="max-w-4xl mx-auto">
          <Link href="/free-documents">
            <Button variant="ghost" size="sm" className="mb-4 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> All Templates
            </Button>
          </Link>
          <div className="flex items-start gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="text-muted-foreground mt-1">{template.description}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> {template.fields.length} fields
                </span>
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> AI-powered
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form */}
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Fill the Details
            </h2>
            {template.fields.map((field, idx) => (
              <motion.div
                key={field.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="space-y-1.5"
              >
                <label className="text-sm font-medium text-foreground">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    value={fieldValues[field.name] || ""}
                    onChange={e => setFieldValues(v => ({ ...v, [field.name]: e.target.value }))}
                    placeholder={field.placeholder}
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm resize-none"
                  />
                ) : field.type === "select" ? (
                  <select
                    value={fieldValues[field.name] || ""}
                    onChange={e => setFieldValues(v => ({ ...v, [field.name]: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                  >
                    <option value="">Select {field.label}</option>
                    {field.options.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : field.type === "date" ? (
                  <input
                    type="date"
                    value={fieldValues[field.name] || ""}
                    onChange={e => setFieldValues(v => ({ ...v, [field.name]: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                  />
                ) : field.type === "number" ? (
                  <input
                    type="number"
                    value={fieldValues[field.name] || ""}
                    onChange={e => setFieldValues(v => ({ ...v, [field.name]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                  />
                ) : (
                  <input
                    type="text"
                    value={fieldValues[field.name] || ""}
                    onChange={e => setFieldValues(v => ({ ...v, [field.name]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                  />
                )}
                {field.help_text && (
                  <p className="text-xs text-muted-foreground">{field.help_text}</p>
                )}
              </motion.div>
            ))}

            <Button
              onClick={() => generateMutation.mutate()}
              disabled={!allRequiredFilled || generateMutation.isPending}
              className="w-full"
              size="lg"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Generating Document...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate Legal Document
                </>
              )}
            </Button>
            {!allRequiredFilled && (
              <p className="text-xs text-muted-foreground text-center">
                Please fill all required fields (*) to generate
              </p>
            )}
            {generateMutation.isError && (
              <p className="text-sm text-red-600 text-center">
                {generateMutation.error instanceof Error ? generateMutation.error.message : "Generation failed. Please try again."}
              </p>
            )}
          </div>

          {/* Preview / Output */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Document Preview
            </h2>
            <AnimatePresence mode="wait">
              {!generated ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-muted/50 border border-dashed border-border rounded-2xl p-8 text-center"
                >
                  <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">
                    Your AI-generated document will appear here after you fill the form and click Generate.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm"
                >
                  <div className="border-b border-border p-3 flex items-center gap-2 flex-wrap">
                    <Button variant="ghost" size="sm" onClick={handleDownload}>
                      <Download className="w-4 h-4 mr-1" /> Download
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCopy}>
                      {copied ? <CheckCircle2 className="w-4 h-4 mr-1 text-green-600" /> : <Copy className="w-4 h-4 mr-1" />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleShare}>
                      <Share2 className="w-4 h-4 mr-1" /> Share
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handlePrint}>
                      <Printer className="w-4 h-4 mr-1" /> Print
                    </Button>
                  </div>
                  <div className="p-5 max-h-[600px] overflow-y-auto">
                    <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-foreground">
                      {generated}
                    </pre>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-10 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-medium mb-1 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Important Disclaimer
          </p>
          <p>
            This document is AI-generated for informational purposes. It may require notarization, registration,
            or stamp duty as per state laws. Consult a qualified lawyer before using it for legal proceedings.
            LitigaForge is not a law firm and does not provide legal advice.
          </p>
        </div>
      </PageShell>
    </>
  );
}
