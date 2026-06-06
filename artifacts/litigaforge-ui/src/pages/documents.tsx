import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  FileText, Download, Share2, Trash2, Upload,
  Loader2, Search, X, ArrowLeft
} from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";

export default function DocumentsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["client-all-documents"],
    queryFn: () => apiFetch("/client/documents"),
    enabled: !!user,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/client/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-all-documents"] }),
  });

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <FileText className="w-12 h-12 text-gray-300 mx-auto" />
          <h2 className="text-xl font-semibold">Sign In Required</h2>
          <Button onClick={() => setLocation("/login")}>Sign In</Button>
        </div>
      </div>
    );
  }

  const docs = (data?.documents ?? []).filter((d: any) =>
    !search || d.filename?.toLowerCase().includes(search.toLowerCase()) || d.case_title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageShell title="Case Documents" subtitle="All your uploaded case files in one place.">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setLocation("/client-dashboard")} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-card rounded-2xl shadow-sm" style={{ border: "1px solid #F1F5F9" }}>
        {/* Header + Search */}
        <div className="px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: "#F1F5F9" }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#F0F9FF" }}>
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="font-bold text-gray-900 text-sm">All Documents</h2>
            <span className="text-[11px] text-gray-400">({data?.total ?? 0})</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white cursor-pointer transition-colors" style={{ background: "#2563EB" }}>
              <Upload className="w-3.5 h-3.5" />
              {uploading ? "Uploading..." : "Upload"}
              <input type="file" className="hidden" disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const form = new FormData();
                    form.append("file", file);
                    const token = typeof window !== "undefined" ? localStorage.getItem("lf_token") : null;
                    const res = await fetch(`/litigaforge/client/cases/0/documents`, {
                      method: "POST",
                      headers: token ? { Authorization: `Bearer ${token}` } : {},
                      body: form,
                    });
                    if (!res.ok) throw new Error("Upload failed");
                    qc.invalidateQueries({ queryKey: ["client-all-documents"] });
                  } catch (err) {
                    alert(err instanceof Error ? err.message : "Upload failed");
                  } finally {
                    setUploading(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
          </div>
        </div>
        <div className="px-5 py-3 border-b" style={{ borderColor: "#F1F5F9" }}>
          <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search by filename or case name..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none" />
            {search && <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
          </div>
        </div>

        {/* Document list */}
        <div className="p-4 space-y-2.5">
          {isLoading && <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></div>}
          {!isLoading && docs.length === 0 && (
            <div className="rounded-xl p-8 text-center" style={{ background: "#F8FAFC", border: "1px dashed #E2E8F0" }}>
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No documents yet.</p>
              <p className="text-xs text-gray-400 mt-1">Upload files from a case detail page.</p>
            </div>
          )}
          {docs.map((doc: any) => (
            <motion.div key={doc.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-4 hover:shadow-sm transition-all" style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#EFF6FF" }}>
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{doc.filename}</p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                      <span className="text-blue-600 font-medium uppercase">{doc.file_type}</span>
                      <span>{doc.file_size ? (doc.file_size / 1024).toFixed(1) + " KB" : "N/A"}</span>
                      <span>{new Date(doc.created_at).toLocaleDateString("en-IN")}</span>
                      {doc.case_title && <span className="text-gray-500">Case: {doc.case_title}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <a href={doc.file_url} download={doc.filename}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Download">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={() => {
                    const text = `Document: ${doc.filename}\n${doc.case_title ? `Case: ${doc.case_title}\n` : ""}Download: ${typeof window !== "undefined" ? window.location.origin : ""}${doc.file_url}\n\n— LitigaForge AI`;
                    if (navigator.share) navigator.share({ title: doc.filename, text });
                    else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                  }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Share">
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => {
                    if (!confirm(`Delete "${doc.filename}"?`)) return;
                    deleteMut.mutate(doc.id);
                  }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
