import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Link } from "wouter";
import {
  User, Mail, Lock, Trash2, Shield, ChevronRight,
  Loader2, CheckCircle, AlertTriangle, Eye, EyeOff,
  CalendarDays, Copy, RefreshCw, Link2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Languages } from "lucide-react";
import { CONNECT_LANGUAGE_STORAGE_KEY, useConnectFlags } from "@/hooks/use-connect-v2";
import { ConnectLanguageSelect } from "@/components/ConnectLanguageSelect";

export default function AccountSettings() {
  const { user, logout } = useAuth();

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <SEOHelmet title="Account Settings" description="Manage your LitigaForge AI account, profile, privacy, and data." canonical="/settings" />

      <div>
        <h1 className="text-xl font-bold text-foreground">Account Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile, privacy, and data rights</p>
      </div>

      <ProfileSection user={user} />
      <LanguagePreferenceSection user={user} />
      {user?.lawyer_status && <><AdvocateProfileSection /><CalendarSyncSection /></>}
      <PasswordSection />
      <PrivacySection />
      <DangerZone onDeleted={logout} />
    </div>
  );
}

function CalendarSyncSection() {
  const queryClient = useQueryClient();
  const [feedUrl, setFeedUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["calendar-sync-status"],
    queryFn: () => apiFetch("/calendar-sync/feed/status"),
    staleTime: 30_000,
  });

  const createFeed = async () => {
    setBusy(true);
    setNotice("");
    try {
      const result = await apiFetch("/calendar-sync/feed", { method: "POST" });
      setFeedUrl(result.feed_url);
      setNotice("Private calendar link created. Save it now; it cannot be shown again.");
      await queryClient.invalidateQueries({ queryKey: ["calendar-sync-status"] });
    } catch (e: any) {
      setNotice(e?.message || "Could not create the calendar link.");
    } finally {
      setBusy(false);
    }
  };

  const revokeFeed = async () => {
    if (!window.confirm("Revoke this calendar link? Any calendar app using it will stop receiving updates.")) return;
    setBusy(true);
    setNotice("");
    try {
      await apiFetch("/calendar-sync/feed", { method: "DELETE" });
      setFeedUrl("");
      setNotice("Calendar link revoked.");
      await queryClient.invalidateQueries({ queryKey: ["calendar-sync-status"] });
    } catch (e: any) {
      setNotice(e?.message || "Could not revoke the calendar link.");
    } finally {
      setBusy(false);
    }
  };

  const copyFeed = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setNotice("Calendar link copied.");
    } catch {
      setNotice("Copy failed. Select and copy the link manually.");
    }
  };

  const enabled = Boolean((data as any)?.enabled);
  const active = Boolean((data as any)?.active);
  return (
    <Card icon={<CalendarDays className="w-4 h-4" />} title="Calendar Sync">
      {isLoading ? <p className="text-sm text-muted-foreground">Checking calendar availability…</p> :
        error ? <p role="alert" className="text-sm text-destructive">Could not check calendar sync status.</p> :
        !enabled ? <p className="text-sm text-muted-foreground">Private calendar sync is not enabled for this deployment.</p> :
        <div className="space-y-3">
          <p className="text-sm leading-6 text-muted-foreground">
            Subscribe to your case hearing dates and accepted Connect case follow-ups from a calendar app.
            The link is private: anyone who has it can view these dates. Keep it confidential.
          </p>
          {active && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">A private feed is active.</p>}
          {feedUrl && <div className="flex gap-2">
            <input aria-label="Private calendar feed URL" readOnly value={feedUrl} className="min-w-0 flex-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs" />
            <button type="button" onClick={copyFeed} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted" aria-label="Copy calendar link">
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </div>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={createFeed} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : active ? <RefreshCw className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
              {active ? "Replace private link" : "Create private link"}
            </button>
            {active && <button type="button" onClick={revokeFeed} disabled={busy} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50">Revoke link</button>}
          </div>
          <p className="text-xs text-muted-foreground">Replacing the link immediately revokes the previous one. If you lose the URL, create a replacement.</p>
          {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
        </div>}
    </Card>
  );
}

function LanguagePreferenceSection({ user }: { user: any }) {
  const { data: flags, isLoading } = useConnectFlags();
  const [language, setLanguage] = useState(user?.preferred_language ?? "en");
  const [savedLanguage, setSavedLanguage] = useState(user?.preferred_language ?? "en");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    setLanguage(user?.preferred_language ?? "en");
    setSavedLanguage(user?.preferred_language ?? "en");
  }, [user?.preferred_language]);
  if (isLoading || !flags?.connect_v2 || !flags.multilang) return null;

  const save = async () => {
    setSaving(true);
    setNotice("");
    try {
      await apiFetch("/auth/profile/language", {
        method: "PATCH",
        body: { preferred_language: language },
      });
      localStorage.setItem(CONNECT_LANGUAGE_STORAGE_KEY, language);
      setSavedLanguage(language);
      setNotice("Preferred language saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save your language preference.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card icon={<Languages className="h-4 w-4" />} title="Language for case connections">
      <div className="space-y-3">
        <p className="text-sm leading-6 text-muted-foreground">Choose the language you prefer for describing a legal matter. Case content stays in the original language; the interface is not machine-translated.</p>
        <ConnectLanguageSelect flags={flags} value={language} onChange={(value) => { setLanguage(value); setNotice(""); }} />
        {notice && <p role="status" className={`text-sm ${notice.includes("saved") ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"}`}>{notice}</p>}
        <button type="button" onClick={save} disabled={saving || language === savedLanguage} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-save-language">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? "Saving…" : "Save language"}
        </button>
      </div>
    </Card>
  );
}

function AdvocateProfileSection() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["advocate-profile-settings"],
    queryFn: () => apiFetch("/lawyers/me/profile"),
    staleTime: 5 * 60 * 1000,
  });
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (data) setForm({
      ...data,
      courts_text: (data.courts_practised || []).join(", "),
      practice_text: (data.practice_areas || []).join(", "),
      languages_text: (data.languages || []).join(", "),
    });
  }, [data]);
  const set = (key: string, value: any) => setForm((old: any) => ({ ...old, [key]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const entries = (value: string) => value.split(",").map((v: string) => v.trim()).filter(Boolean);
    try {
      const result = await apiFetch("/lawyers/me/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name, email: form.email, phone: form.phone,
          bar_number: form.bar_number, bar_council: form.bar_council, district: form.district,
          courts_practised: entries(form.courts_text || ""),
          practice_areas: entries(form.practice_text || ""),
          languages: entries(form.languages_text || ""),
          experience_years: Number(form.experience_years || 0),
          hourly_rate: form.hourly_rate === "" ? null : Number(form.hourly_rate),
          bio: form.bio || "",
        }),
      });
      setForm((old: any) => ({ ...old, ...result }));
      setMessage(result.verification_status === "pending"
        ? "Saved. Changes to your enrolment details require verification again."
        : "Advocate profile saved.");
    } catch (e: any) {
      setMessage(e.message || "Could not save your advocate profile.");
    } finally {
      setSaving(false);
    }
  };
  if (isLoading) return <Card icon={<Shield className="w-4 h-4" />} title="Advocate Profile"><p className="text-sm text-muted-foreground">Loading profile…</p></Card>;
  if (error || !data) return null;
  const fields = [
    ["name", "Full name"], ["email", "Email"], ["phone", "Phone"],
    ["bar_number", "Bar enrolment number"], ["bar_council", "State Bar Council"],
    ["district", "City / district"], ["courts_text", "Courts practised in (comma-separated)"],
    ["practice_text", "Practice areas (comma-separated)"], ["languages_text", "Languages (comma-separated)"],
    ["experience_years", "Experience (years)"], ["hourly_rate", "Fee (₹)"],
  ];
  return <Card icon={<Shield className="w-4 h-4" />} title="Advocate Profile"
    badge={<span className="text-xs text-muted-foreground">Verification: {form.verification_status || data.verification_status}</span>}>
    <form onSubmit={save} className="space-y-4">
      {form.verification_status === "rejected" && form.rejection_reason && <p className="rounded-lg bg-red-50 text-red-700 p-3 text-sm">Rejected: {form.rejection_reason}</p>}
      <div className="grid sm:grid-cols-2 gap-4">
        {fields.map(([key, label]) => <Field key={key} label={label}><input value={form[key] ?? ""} onChange={e => set(key, e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></Field>)}
      </div>
      <Field label="Short bio"><textarea value={form.bio || ""} onChange={e => set("bio", e.target.value)} maxLength={1000} rows={4} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></Field>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      <button disabled={saving} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-50">{saving ? "Saving…" : "Save advocate profile"}</button>
    </form>
  </Card>;
}

/* ── Profile Section ──────────────────────────────────────────────────────── */
function ProfileSection({ user }: { user: any }) {
  const { refreshUser } = useAuth() as any;
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState("");

  const dirty = name !== (user?.name ?? "") || email !== (user?.email ?? "");

  const save = async () => {
    setSaving(true);
    setStatus("idle");
    try {
      await apiFetch("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase() }),
      });
      setStatus("ok");
      refreshUser?.();
      setTimeout(() => setStatus("idle"), 3000);
    } catch (e: any) {
      setErrMsg(e.message || "Failed to update profile");
      setStatus("err");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card icon={<User className="w-4 h-4" />} title="Profile Information"
      badge={<span className="text-xs text-muted-foreground">DPDP Act § 12(a) — Right to Correction</span>}>
      <div className="space-y-4">
        <Field label="Full Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Your full name"
            maxLength={100}
          />
        </Field>
        <Field label="Email Address">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="you@example.com"
          />
        </Field>

        <AnimatePresence mode="wait">
          {status === "ok" && (
            <motion.div key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle className="w-4 h-4" /> Profile updated successfully
            </motion.div>
          )}
          {status === "err" && (
            <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4" /> {errMsg}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={save}
          disabled={saving || !dirty || !name.trim() || !email.includes("@")}
          className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </Card>
  );
}

/* ── Password Section ─────────────────────────────────────────────────────── */
function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState("");

  const save = async () => {
    if (next !== confirm) { setErrMsg("New passwords do not match"); setStatus("err"); return; }
    if (next.length < 8) { setErrMsg("Password must be at least 8 characters"); setStatus("err"); return; }
    setSaving(true); setStatus("idle");
    try {
      await apiFetch("/auth/password", {
        method: "PATCH",
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      setStatus("ok");
      setCurrent(""); setNext(""); setConfirm("");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (e: any) {
      setErrMsg(e.message || "Failed to update password");
      setStatus("err");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card icon={<Lock className="w-4 h-4" />} title="Change Password">
      <div className="space-y-3">
        <Field label="Current Password">
          <PasswordInput value={current} onChange={setCurrent} show={showCurrent} onToggle={() => setShowCurrent(v => !v)} placeholder="Current password" />
        </Field>
        <Field label="New Password">
          <PasswordInput value={next} onChange={setNext} show={showNext} onToggle={() => setShowNext(v => !v)} placeholder="Minimum 8 characters" />
        </Field>
        <Field label="Confirm New Password">
          <PasswordInput value={confirm} onChange={setConfirm} show={showNext} onToggle={() => setShowNext(v => !v)} placeholder="Re-enter new password" />
        </Field>

        <AnimatePresence mode="wait">
          {status === "ok" && (
            <motion.div key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle className="w-4 h-4" /> Password changed successfully
            </motion.div>
          )}
          {status === "err" && (
            <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4" /> {errMsg}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={save}
          disabled={saving || !current || !next || !confirm}
          className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? "Updating…" : "Update Password"}
        </button>
      </div>
    </Card>
  );
}

/* ── Privacy Section ──────────────────────────────────────────────────────── */
function PrivacySection() {
  return (
    <Card icon={<Shield className="w-4 h-4" />} title="Privacy & Data Rights"
      badge={<span className="text-xs text-muted-foreground">DPDP Act 2023</span>}>
      <div className="space-y-2">
        {[
          { label: "View Privacy Policy", sub: "How we collect, use and protect your data", href: "/privacy" },
          { label: "View Terms of Service", sub: "Rules and conditions for using the platform", href: "/terms" },
        ].map(({ label, sub, href }) => (
          <Link key={href} href={href}>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors cursor-pointer group">
              <div>
                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{label}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Link>
        ))}
        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
          <div>
            <p className="text-sm font-medium text-foreground">Request Data Export</p>
            <p className="text-xs text-muted-foreground">DPDP Act § 11 — Right to Access</p>
          </div>
          <a href="mailto:info@litigaforge.com?subject=Data Access Request"
            className="text-xs font-semibold text-primary hover:underline">
            Email DPO
          </a>
        </div>
      </div>
    </Card>
  );
}

/* ── Danger Zone ──────────────────────────────────────────────────────────── */
function DangerZone({ onDeleted }: { onDeleted: () => void }) {
  const [step, setStep] = useState<"idle" | "confirm" | "typing" | "deleting">("idle");
  const [typed, setTyped] = useState("");
  const CONFIRM_WORD = "DELETE";

  const handleDelete = async () => {
    setStep("deleting");
    try {
      await apiFetch("/auth/account", { method: "DELETE" });
      onDeleted();
    } catch (e: any) {
      setStep("typing");
    }
  };

  return (
    <Card icon={<Trash2 className="w-4 h-4 text-red-500" />} title="Delete Account"
      danger
      badge={<span className="text-xs text-red-500 font-semibold">DPDP Act § 12(1)(b) — Right to Erasure</span>}>
      <AnimatePresence mode="wait">
        {step === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Permanently deletes your account, all case data, uploaded documents, chat messages, and match history.
              <strong className="text-foreground"> This cannot be undone.</strong>
            </p>
            <button onClick={() => setStep("confirm")}
              className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors">
              Delete My Account
            </button>
          </motion.div>
        )}

        {step === "confirm" && (
          <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800 space-y-1">
                <p className="font-semibold">Everything will be deleted permanently:</p>
                <ul className="text-xs space-y-0.5 list-disc list-inside text-red-700">
                  <li>Your name, email and password</li>
                  <li>All case descriptions and requirements</li>
                  <li>All uploaded documents (files deleted from disk)</li>
                  <li>All chat messages and match proposals</li>
                  <li>All legal questions and AI answers</li>
                  <li>All active login sessions</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep("typing")}
                className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors">
                Yes, Continue
              </button>
              <button onClick={() => setStep("idle")}
                className="px-4 py-2 bg-muted text-foreground text-sm font-semibold rounded-lg hover:bg-muted/80 transition-colors">
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        {(step === "typing" || step === "deleting") && (
          <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-800 font-medium">
              Type <span className="font-mono font-bold">{CONFIRM_WORD}</span> to confirm permanent deletion:
            </p>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value.toUpperCase())}
              placeholder={CONFIRM_WORD}
              disabled={step === "deleting"}
              className="w-full px-3 py-2 rounded-lg border border-red-300 bg-card text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50"
            />
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={typed !== CONFIRM_WORD || step === "deleting"}
                className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {step === "deleting" && <Loader2 className="w-4 h-4 animate-spin" />}
                {step === "deleting" ? "Deleting…" : "Permanently Delete Account"}
              </button>
              <button onClick={() => { setStep("idle"); setTyped(""); }}
                disabled={step === "deleting"}
                className="px-4 py-2 bg-muted text-foreground text-sm font-semibold rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50">
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

/* ── Shared primitives ────────────────────────────────────────────────────── */
function Card({ icon, title, badge, danger, children }: {
  icon: React.ReactNode; title: string; badge?: React.ReactNode; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border bg-card p-5 space-y-4 ${danger ? "border-red-200" : "border-border"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={danger ? "text-red-500" : "text-primary"}>{icon}</span>
          <h2 className={`text-sm font-bold ${danger ? "text-red-700" : "text-foreground"}`}>{title}</h2>
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function PasswordInput({ value, onChange, show, onToggle, placeholder }: {
  value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder: string;
}) {
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 pr-10 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
