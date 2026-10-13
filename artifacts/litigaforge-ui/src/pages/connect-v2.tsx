import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import {
  ArrowLeft, ArrowRight, BadgeCheck, BriefcaseBusiness, CalendarDays, Check,
  ChevronLeft, ChevronRight, Clock3, FileText, Languages, MapPin, MessageSquareText,
  Mic, Paperclip, Phone, ShieldCheck, Square, UserRound, X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ConnectLanguageSelect } from "@/components/ConnectLanguageSelect";
import { useAuth } from "@/lib/auth-context";
import { CONNECT_LANGUAGE_STORAGE_KEY, useConnectFlags, languageName, type ConnectCase, type ConnectRequest } from "@/hooks/use-connect-v2";
import { useLanguage } from "@/hooks/useLanguage";
import { connectV2Strings } from "@/i18n/connect-v2";

const PROBLEM_TYPES = [
  "Property & land", "Family & matrimonial", "Criminal matter", "Civil dispute",
  "Employment & labour", "Consumer rights", "Business & contracts", "Other",
];

const inputClass = "w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15";
const cardClass = "rounded-2xl border border-border bg-card shadow-[0_12px_40px_color-mix(in_oklch,hsl(var(--foreground))_4%,transparent)]";

interface ConnectUpload {
  object_path: string;
  filename: string;
  content_type: string;
  size: number;
}

interface SelectedAttachment {
  key: number;
  file: File;
  objectPath?: string;
  uploading: boolean;
  error?: string;
}

async function uploadConnectFile(file: File): Promise<ConnectUpload> {
  const form = new FormData();
  form.append("file", file, file.name);
  const uploaded = await apiFetch("/connect-v2/uploads", { method: "POST", body: form }) as ConnectUpload;
  if (!uploaded?.object_path) throw new Error("The upload did not return a stored object path.");
  return uploaded;
}

function TranslationReadingView({ text, sourceLanguage }: { text: string; sourceLanguage: string }) {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const copy = connectV2Strings(lang);
  const targetLanguage = localStorage.getItem(CONNECT_LANGUAGE_STORAGE_KEY)
    || (user as (typeof user & { preferred_language?: string }) | null)?.preferred_language
    || "en";
  const [translation, setTranslation] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "available" | "unavailable">("idle");
  const [showOriginal, setShowOriginal] = useState(true);
  const phase3 = ["as", "brx", "doi", "ks", "kok", "mai", "mni", "ne", "sa", "sat", "sd"].includes(sourceLanguage);
  const scriptFonts: Record<string, { family: string; href: string }> = {
    hi: { family: "Noto Sans Devanagari", href: "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap" },
    te: { family: "Noto Sans Telugu", href: "https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;500;600;700&display=swap" },
    ta: { family: "Noto Sans Tamil", href: "https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600;700&display=swap" },
    kn: { family: "Noto Sans Kannada", href: "https://fonts.googleapis.com/css2?family=Noto+Sans+Kannada:wght@400;500;600;700&display=swap" },
    ml: { family: "Noto Sans Malayalam", href: "https://fonts.googleapis.com/css2?family=Noto+Sans+Malayalam:wght@400;500;600;700&display=swap" },
    bn: { family: "Noto Sans Bengali", href: "https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap" },
    gu: { family: "Noto Sans Gujarati", href: "https://fonts.googleapis.com/css2?family=Noto+Sans+Gujarati:wght@400;500;600;700&display=swap" },
    pa: { family: "Noto Sans Gurmukhi", href: "https://fonts.googleapis.com/css2?family=Noto+Sans+Gurmukhi:wght@400;500;600;700&display=swap" },
    or: { family: "Noto Sans Oriya", href: "https://fonts.googleapis.com/css2?family=Noto+Sans+Oriya:wght@400;500;600;700&display=swap" },
    ur: { family: "Noto Nastaliq Urdu", href: "https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;500;600&display=swap" },
    sd: { family: "Noto Nastaliq Urdu", href: "https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;500;600&display=swap" },
  };
  const sourceFont = scriptFonts[sourceLanguage] ?? (["mr", "brx", "doi", "kok", "mai", "ne", "sa"].includes(sourceLanguage)
    ? scriptFonts.hi
    : ["as", "mni"].includes(sourceLanguage) ? scriptFonts.bn : undefined);
  const targetFont = scriptFonts[targetLanguage];

  useEffect(() => {
    setTranslation("");
    setState("idle");
    setShowOriginal(true);
  }, [text, sourceLanguage, targetLanguage]);

  useEffect(() => {
    for (const font of [sourceFont, targetFont]) {
      if (!font || document.querySelector(`link[data-connect-font="${font.family}"]`)) continue;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = font.href;
      link.dataset.connectFont = font.family;
      document.head.appendChild(link);
    }
  }, [sourceFont, targetFont]);

  if (sourceLanguage === targetLanguage) return null;

  const translate = async () => {
    setState("loading");
    setTranslation("");
    try {
      const result = await apiFetch("/connect-v2/translate", {
        method: "POST",
        body: { text, source_language: sourceLanguage, target_language: targetLanguage },
      }) as { text?: string; unavailable?: boolean; translated?: boolean };
      const translated = result?.text ?? "";
      if (!translated.trim() || result.unavailable || result.translated === false) throw new Error("Translation unavailable");
      setTranslation(translated);
      setState("available");
    } catch {
      setState("unavailable");
    }
  };

  return (
    <div className={`grid gap-3 ${state === "available" && !showOriginal && !phase3 ? "sm:grid-cols-1" : "sm:grid-cols-2"}`} data-testid="translation-reading-view">
      {(state !== "available" || showOriginal || phase3) && <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-primary">{copy.original} · {languageName(sourceLanguage)}</p>
        <p dir={sourceLanguage === "ur" || sourceLanguage === "sd" ? "rtl" : "ltr"} lang={sourceLanguage} style={sourceFont ? { fontFamily: `"${sourceFont.family}", sans-serif` } : undefined} className="whitespace-pre-wrap text-sm leading-7">{text}</p>
      </div>}
      <div className="rounded-xl border border-border bg-muted/35 p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{copy.translation} · {languageName(targetLanguage)}</p>
            {state === "available" && <p className="mt-1 text-[10px] text-muted-foreground">{copy.translatedFrom} {languageName(sourceLanguage)}</p>}
          </div>
          <button type="button" onClick={translate} disabled={state === "loading"} data-testid="button-translate-original" className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:border-primary/40 disabled:opacity-50">
            {state === "loading" ? copy.translating : state === "available" ? copy.translateAgain : copy.translate}
          </button>
        </div>
        {state === "available"
          ? <div>
              <p dir={targetLanguage === "ur" || targetLanguage === "sd" ? "rtl" : "ltr"} lang={targetLanguage} style={targetFont ? { fontFamily: `"${targetFont.family}", sans-serif` } : undefined} className="whitespace-pre-wrap text-sm leading-7">{translation}</p>
              {!phase3 && <button type="button" onClick={() => setShowOriginal((shown) => !shown)} className="mt-3 text-xs font-semibold text-primary underline-offset-4 hover:underline">{showOriginal ? copy.hideOriginal : copy.viewOriginal}</button>}
            </div>
          : state === "unavailable"
            ? <p role="status" className="text-sm leading-6 text-muted-foreground">{copy.translationUnavailable}</p>
            : <p className="text-sm leading-6 text-muted-foreground">{copy.noTranslationRequested} {copy.originalAuthoritative}</p>}
      </div>
    </div>
  );
}

function ConnectHeader({ eyebrow, title, description, step }: { eyebrow: string; title: string; description: string; step?: number }) {
  return (
    <div className="mb-7">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-primary">
        <span className="h-px w-6 bg-primary/70" />{eyebrow}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="connect-display text-4xl font-medium leading-tight text-foreground sm:text-5xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {step && <div className="cfos-mono text-xs text-muted-foreground">STEP {step} / 3</div>}
      </div>
    </div>
  );
}

function ConnectAlert({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "note" | "success" }) {
  const toneClass = tone === "error"
    ? "border-destructive/25 bg-destructive/5 text-destructive"
    : tone === "success"
      ? "border-emerald-700/20 bg-emerald-700/5 text-emerald-800 dark:text-emerald-200"
      : "border-primary/20 bg-primary/5 text-foreground";
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm leading-6 ${toneClass}`}>{children}</div>;
}

export function ConnectCasePost() {
  const flagsQuery = useConnectFlags();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [problemType, setProblemType] = useState("");
  const [description, setDescription] = useState("");
  const [location, setCaseLocation] = useState("");
  const [hideName, setHideName] = useState(true);
  const [language, setLanguage] = useState(() => localStorage.getItem(CONNECT_LANGUAGE_STORAGE_KEY) || "en");
  const [files, setFiles] = useState<SelectedAttachment[]>([]);
  const [error, setError] = useState("");
  const [voicePath, setVoicePath] = useState("");
  const [voiceFilename, setVoiceFilename] = useState("");
  const [voiceLanguage, setVoiceLanguage] = useState("en");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceUploading, setVoiceUploading] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const attachmentSequence = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const flags = flagsQuery.data;

  useEffect(() => () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const uploadAttachment = async (key: number, file: File) => {
    setFiles((current) => current.map((item) => item.key === key ? { ...item, uploading: true, error: undefined } : item));
    try {
      const uploaded = await uploadConnectFile(file);
      setFiles((current) => current.map((item) => item.key === key
        ? { ...item, objectPath: uploaded.object_path, uploading: false }
        : item));
    } catch (failure) {
      setFiles((current) => current.map((item) => item.key === key
        ? { ...item, uploading: false, error: failure instanceof Error ? failure.message : "Upload failed" }
        : item));
    }
  };

  const handleFileSelection = (selected: FileList | null) => {
    if (!selected?.length) return;
    const chosenFiles = Array.from(selected);
    const validFiles = chosenFiles.filter((file) => file.type.startsWith("image/") || file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    const added = validFiles.map((file) => ({
      key: ++attachmentSequence.current,
      file,
      uploading: true,
    }));
    setFiles((current) => [...current, ...added]);
    added.forEach((attachment) => { void uploadAttachment(attachment.key, attachment.file); });
    if (validFiles.length !== chosenFiles.length) setError("Only image and PDF files can be attached.");
    else if (added.length) setError("");
  };

  const startVoiceRecording = async () => {
    setVoiceError("");
    setVoicePath("");
    setVoiceFilename("");
    setVoiceLanguage(language);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError("Audio recording is not supported by this browser. You can still describe the matter in text.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      voiceChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) voiceChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setVoiceRecording(false);
        const blob = new Blob(voiceChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (!blob.size) {
          setVoiceError("No audio was captured. Please try recording again.");
          return;
        }
        const extension = blob.type.includes("mp4") ? "m4a" : "webm";
        const audioFile = new File([blob], `case-voice-note.${extension}`, { type: blob.type || "audio/webm" });
        setVoiceUploading(true);
        try {
          const uploaded = await uploadConnectFile(audioFile);
          setVoicePath(uploaded.object_path);
          setVoiceFilename(uploaded.filename || audioFile.name);
          const transcriptionForm = new FormData();
          transcriptionForm.append("file", audioFile, audioFile.name);
          const transcription = await apiFetch("/connect-v2/voice/transcribe", {
            method: "POST",
            body: transcriptionForm,
          }) as { transcript: string; language: string };
          setVoiceTranscript(transcription.transcript);
          setVoiceLanguage(transcription.language);
        } catch (failure) {
          setVoiceError(failure instanceof Error
            ? `${failure.message} The audio is kept; you can enter the transcript manually.`
            : "Voice note processing failed. The audio is kept; you can enter the transcript manually.");
        } finally {
          setVoiceUploading(false);
        }
      };
      recorder.start();
      setVoiceRecording(true);
    } catch (failure) {
      setVoiceError(failure instanceof Error ? failure.message : "Microphone access was not available.");
      streamRef.current?.getTracks().forEach((track) => track.stop());
    }
  };

  const stopVoiceRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  };

  const postMutation = useMutation({
    mutationFn: async () => {
      if (files.some((item) => item.uploading || !item.objectPath)) {
        throw new Error("Wait for every selected file to finish uploading, or remove files that could not be uploaded.");
      }
      return apiFetch<{ case: ConnectCase }>("/connect-v2/cases", {
        method: "POST",
        body: {
        problem_type: problemType,
        description: description.trim(),
        location: location.trim(),
        hide_name: hideName,
        language,
        document_paths: files.map((item) => item.objectPath as string),
        ...(voicePath ? {
          voice_path: voicePath,
          voice_transcript: voiceTranscript.trim(),
          voice_language: voiceLanguage,
        } : {}),
        },
      });
    },
    onSuccess: (result) => setLocation(`/my-cases/${result.case.id}`),
    onError: (failure: Error) => setError(failure.message || "Your case could not be posted. Please try again."),
  });

  const continueStep = () => {
    setError("");
    if (step === 1 && !problemType) { setError("Choose the kind of legal help you need to continue."); return; }
    if (step === 2 && description.trim().length < 20) { setError("Add a little more detail so an advocate can understand your situation (at least 20 characters)."); return; }
    if (step === 2 && files.some((item) => item.uploading || !item.objectPath)) {
      setError("Wait for each selected file to finish uploading, or remove files that could not be uploaded.");
      return;
    }
    if (step === 2 && (voiceRecording || voiceUploading)) {
      setError("Wait for the voice note to finish uploading before continuing.");
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  };

  if (flagsQuery.isLoading) {
    return <div className="mx-auto w-full max-w-4xl px-4 py-10"><div className="h-32 animate-pulse rounded-2xl bg-muted" /><div className="mt-4 h-64 animate-pulse rounded-2xl bg-muted" /></div>;
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-7 sm:px-7 sm:pt-10">
      <ConnectHeader
        eyebrow="A direct, fair introduction"
        title="Post a case"
        description="Tell verified advocates what is happening, in your own words. There is no paid ranking or referral fee."
        step={step}
      />
      <div className="mb-5 flex items-center gap-2" aria-label="Posting progress">
        {[1, 2, 3].map((part) => <span key={part} className={`h-1.5 flex-1 rounded-full transition-colors ${part <= step ? "bg-primary" : "bg-border"}`} />)}
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_260px]">
          <section className="min-w-0 p-5 sm:p-8">
            {step === 1 && <div className="connect-step-enter">
              <div className="mb-5">
                <h2 className="text-xl font-semibold tracking-tight">What kind of matter is this?</h2>
                <p className="mt-1 text-sm text-muted-foreground">Select the closest fit. You can explain the details next.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {PROBLEM_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    data-testid={`button-problem-${type.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                    aria-pressed={problemType === type}
                    onClick={() => { setProblemType(type); setError(""); }}
                    className={`flex min-h-[58px] items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${problemType === type ? "border-primary/60 bg-primary/7 text-foreground ring-1 ring-primary/30" : "border-border bg-background hover:border-primary/30 hover:bg-muted/50"}`}
                  >
                    {type}<span className={`grid h-5 w-5 place-items-center rounded-full border ${problemType === type ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{problemType === type && <Check className="h-3 w-3" />}</span>
                  </button>
                ))}
              </div>
              {flags?.multilang && <div className="mt-7 border-t border-border pt-6">
                <label htmlFor="case-language" className="mb-2 flex items-center gap-2 text-sm font-semibold"><Languages className="h-4 w-4 text-primary" />Language for your description</label>
                <ConnectLanguageSelect flags={flags} value={language} onChange={setLanguage} id="case-language" />
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Your original wording is preserved. We do not automatically translate legal details.</p>
              </div>}
            </div>}

            {step === 2 && <div className="connect-step-enter space-y-5">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Describe what happened</h2>
                <p className="mt-1 text-sm text-muted-foreground">Add important dates, people involved, and what help you are looking for.</p>
              </div>
              <div>
                <label htmlFor="case-description" className="mb-2 block text-sm font-semibold">Your situation</label>
                <textarea id="case-description" data-testid="input-case-description" className={`${inputClass} min-h-48 resize-y leading-6`} maxLength={5000} value={description} onChange={(event) => { setDescription(event.target.value); setError(""); }} placeholder="Start wherever it feels easiest. Use the language you selected above." />
                <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>Only share what an advocate needs to understand.</span><span>{description.length} / 5,000</span></div>
              </div>
              <div>
                <label htmlFor="case-location" className="mb-2 flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-primary" />City or district</label>
                <input id="case-location" data-testid="input-case-location" className={inputClass} value={location} onChange={(event) => setCaseLocation(event.target.value)} placeholder="For example, Pune, Maharashtra" maxLength={100} />
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/30 p-4">
                <input data-testid="checkbox-hide-name" type="checkbox" checked={hideName} onChange={(event) => setHideName(event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                <span><span className="block text-sm font-semibold">Hide my name from the initial request</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Your name stays private while advocates review the matter.</span></span>
              </label>
              <div className="rounded-xl border border-dashed border-border bg-background p-4">
                <div className="flex items-start gap-3">
                  <Paperclip className="mt-0.5 h-4 w-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <label className="block text-sm font-semibold" htmlFor="case-files">Supporting documents</label>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Upload multiple photos or PDFs securely. On a phone, choose the camera option to capture a document.</p>
                    <input id="case-files" data-testid="input-case-files" type="file" multiple accept="image/*,.pdf" capture="environment" onChange={(event) => { handleFileSelection(event.target.files); event.target.value = ""; }} className="mt-3 block w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary" />
                    {files.length > 0 && <div className="mt-3 space-y-1.5">
                      {files.map((attachment) => <div key={attachment.key} className="flex flex-wrap items-center gap-2 text-xs">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" /><span className="min-w-0 flex-1 truncate">{attachment.file.name}</span>
                        <span className={attachment.error ? "text-destructive" : "text-muted-foreground"}>{attachment.uploading ? "Uploading…" : attachment.error ? "Upload failed" : "Uploaded"}</span>
                        {attachment.error && <button type="button" onClick={() => void uploadAttachment(attachment.key, attachment.file)} className="rounded px-2 py-1 font-semibold text-primary hover:bg-primary/10" data-testid={`button-retry-file-${attachment.key}`}>Retry</button>}
                        <button type="button" aria-label={`Remove ${attachment.file.name}`} data-testid={`button-remove-file-${attachment.key}`} onClick={() => setFiles((current) => current.filter((item) => item.key !== attachment.key))} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                      </div>)}
                    </div>}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-dashed border-border bg-background p-4">
                <div className="flex items-start gap-3">
                  <Mic className="mt-0.5 h-4 w-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Add a voice note</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Speak naturally. Gemini transcribes the recording in its original language; check or edit the transcript before posting. The original audio is preserved.</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {!voiceRecording
                        ? <Button type="button" variant="outline" onClick={() => void startVoiceRecording()} disabled={voiceUploading} data-testid="button-start-voice-recording"><Mic className="mr-2 h-4 w-4" />{voicePath ? "Record again" : "Start recording"}</Button>
                        : <Button type="button" variant="destructive" onClick={stopVoiceRecording} data-testid="button-stop-voice-recording"><Square className="mr-2 h-4 w-4" />Stop & upload</Button>}
                      {voiceUploading && <span role="status" className="text-xs text-muted-foreground">Uploading voice note…</span>}
                      {voicePath && !voiceUploading && <span className="text-xs font-medium text-emerald-800 dark:text-emerald-200">Uploaded: {voiceFilename}</span>}
                      {voicePath && !voiceUploading && <button type="button" onClick={() => { setVoicePath(""); setVoiceFilename(""); }} className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted" data-testid="button-remove-voice-note">Remove audio</button>}
                    </div>
                    {voiceError && <p role="alert" className="mt-2 text-xs text-destructive">{voiceError}</p>}
                    {(voicePath || voiceRecording || voiceTranscript) && <div className="mt-4">
                      <label htmlFor="voice-transcript" className="mb-1.5 block text-xs font-semibold">Transcript / notes · original language</label>
                      <textarea id="voice-transcript" data-testid="input-voice-transcript" className={`${inputClass} min-h-24 resize-y`} maxLength={4000} value={voiceTranscript} onChange={(event) => setVoiceTranscript(event.target.value)} placeholder="Type or edit the words you want to accompany the audio. No automatic transcription is performed." />
                      <p className="mt-1 text-[11px] text-muted-foreground">Language code sent with the recording: <strong className="font-semibold text-foreground">{voiceLanguage}</strong>{flags?.multilang ? ` · ${languageName(voiceLanguage)}` : ""}</p>
                    </div>}
                  </div>
                </div>
              </div>
            </div>}

            {step === 3 && <div className="connect-step-enter space-y-5">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Review before posting</h2>
                <p className="mt-1 text-sm text-muted-foreground">Your request will be shared with advocates who choose to respond.</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{problemType}</span>
                  {location && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{location}</span>}
                  {hideName && <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">Name hidden</span>}
                </div>
                {flags?.multilang && <p className="mt-3 text-xs text-muted-foreground">Written in <strong className="font-semibold text-foreground">{languageName(language)}</strong></p>}
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground">{description}</p>
              </div>
              {flags?.multilang && language !== "en" && <TranslationReadingView text={description} sourceLanguage={language} />}
              {files.length > 0 && <div className="rounded-xl border border-border bg-muted/35 p-4">
                <p className="text-xs font-semibold">Supporting files · {files.length}</p>
                <ul className="mt-2 space-y-1">{files.map((item) => <li key={item.key} className="flex items-center gap-2 text-xs text-muted-foreground"><FileText className="h-3.5 w-3.5" />{item.file.name}{item.uploading && " · uploading"}</li>)}</ul>
              </div>}
              {voicePath && <div className="rounded-xl border border-border bg-muted/35 p-4 text-xs">
                <p className="font-semibold">Voice note · {languageName(voiceLanguage)}</p><p className="mt-1 text-muted-foreground">{voiceFilename}</p>
                {voiceTranscript && <p className="mt-3 whitespace-pre-wrap leading-5">{voiceTranscript}</p>}
                {!voiceTranscript && <p className="mt-2 text-muted-foreground">No transcript added. Advocates will receive the audio in its original language.</p>}
              </div>}
              <ConnectAlert tone="note"><span className="font-semibold">A note on privacy.</span> Your request is shared only to help connect you with an advocate. Posting does not create an attorney–client relationship.</ConnectAlert>
            </div>}

            {error && <div className="mt-5"><ConnectAlert>{error}</ConnectAlert></div>}
            {postMutation.isError && <div className="mt-5"><ConnectAlert>{(postMutation.error as Error).message}</ConnectAlert></div>}
            <div className="mt-7 flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-between">
              <Button variant="outline" onClick={() => step === 1 ? setLocation("/my-cases") : setStep((current) => current - 1)} disabled={postMutation.isPending} data-testid="button-case-back">
                {step === 1 ? <><ArrowLeft className="mr-2 h-4 w-4" />Cancel</> : <><ChevronLeft className="mr-2 h-4 w-4" />Back</>}
              </Button>
              {step < 3
                ? <Button onClick={continueStep} data-testid="button-case-continue">Continue<ChevronRight className="ml-2 h-4 w-4" /></Button>
                : <Button disabled={postMutation.isPending || files.some((item) => item.uploading || !item.objectPath) || voiceRecording || voiceUploading} onClick={() => { setError(""); postMutation.mutate(); }} data-testid="button-case-submit">
                    {postMutation.isPending ? "Posting your case…" : "Post case"}{!postMutation.isPending && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>}
            </div>
          </section>

          <aside className="connect-surface border-t border-border p-5 lg:border-l lg:border-t-0 lg:p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
            <h3 className="mt-4 text-sm font-bold">A fair connection</h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Advocates decide independently whether to respond. No one can pay to move ahead of another advocate.</p>
            <div className="mt-6 space-y-4">
              {["Choose the matter", "Explain in your words", "Review and share"].map((label, index) => (
                <div key={label} className={`flex items-center gap-3 text-xs ${step === index + 1 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  <span className={`grid h-6 w-6 place-items-center rounded-full border text-[10px] ${step > index + 1 ? "border-primary bg-primary text-primary-foreground" : step === index + 1 ? "border-primary text-primary" : "border-border"}`}>{step > index + 1 ? <Check className="h-3 w-3" /> : index + 1}</span>{label}
                </div>
              ))}
            </div>
            <div className="mt-6 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">Need urgent help? Call the National Legal Services Authority helpline at <strong className="text-foreground">15100</strong>.</div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export function ConnectMyCases() {
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch } = useQuery<{ cases: ConnectCase[] }>({
    queryKey: ["connect-v2-cases-mine", user?.id],
    queryFn: () => apiFetch("/connect-v2/cases/mine") as Promise<{ cases: ConnectCase[] }>,
    enabled: !!user,
  });
  const [, setLocation] = useLocation();
  const cases = data?.cases ?? [];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-7 sm:px-7 sm:pt-10">
      <ConnectHeader eyebrow="Your legal matters" title="My cases" description="A clear view of your requests, advocate responses, and next steps." />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" />Only you can see your case updates.</div>
        <Button onClick={() => setLocation("/post-case")} data-testid="button-post-another-case"><FileText className="mr-2 h-4 w-4" />Post a case</Button>
      </div>
      {isLoading && <div className="space-y-3" aria-label="Loading cases"><div className="h-28 animate-pulse rounded-2xl bg-muted" /><div className="h-28 animate-pulse rounded-2xl bg-muted" /></div>}
      {isError && <div className={`${cardClass} p-7 text-center`}><p className="font-semibold">Your cases did not load</p><p className="mt-1 text-sm text-muted-foreground">{(error as Error).message}</p><Button className="mt-4" variant="outline" onClick={() => refetch()}>Try again</Button></div>}
      {!isLoading && !isError && cases.length === 0 && <div className={`${cardClass} connect-surface px-6 py-14 text-center`}>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><BriefcaseBusiness className="h-6 w-6" /></div>
        <h2 className="mt-5 text-xl font-semibold">No cases here yet</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">When you post a case, it will appear here with responses and practical next steps.</p>
        <Button className="mt-6" onClick={() => setLocation("/post-case")}>Post your first case<ArrowRight className="ml-2 h-4 w-4" /></Button>
      </div>}
      {!isLoading && !isError && cases.length > 0 && <div className="space-y-3">
        {cases.map((item) => <button key={item.id} data-testid={`card-connect-case-${item.id}`} onClick={() => setLocation(`/my-cases/${item.id}`)} className={`${cardClass} group w-full p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg`}>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{item.problem_type}</span>
                <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{item.status.replace(/_/g, " ")}</span>
                <span className="text-xs text-muted-foreground">Case #{item.id}</span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-foreground">{item.description}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {item.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{item.location}</span>}
                <span className="inline-flex items-center gap-1"><Languages className="h-3.5 w-3.5" />{languageName(item.language)}</span>
                {item.advocate?.name && <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{item.advocate.name}</span>}
              </div>
              {item.next_step && <p className="mt-4 border-l-2 border-primary/60 pl-3 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Next:</strong> {item.next_step}</p>}
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2">Open case<ArrowRight className="h-3.5 w-3.5 transition-all" /></span>
          </div>
        </button>)}
      </div>}
    </main>
  );
}

type CaseDocument = NonNullable<ConnectCase["documents"]>[number];
type CaseListResponse = ConnectCase[] | { cases?: ConnectCase[] };

function casesFromResponse(response?: CaseListResponse): ConnectCase[] {
  return Array.isArray(response) ? response : response?.cases ?? [];
}

function caseDocuments(item: ConnectCase): CaseDocument[] {
  const photos: CaseDocument[] = (item.photos ?? []).map((photo) => typeof photo === "string" ? { object_path: photo } : photo);
  const paths: CaseDocument[] = (item.document_paths ?? []).map((object_path) => ({ object_path }));
  const seen = new Set<string>();
  return [...(item.documents ?? []), ...photos, ...paths].filter((document) => {
    const key = document.url ?? document.path ?? document.object_path ?? "";
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ConnectDocumentLinks({ documents }: { documents: CaseDocument[] }) {
  if (!documents.length) {
    return <p className="mt-3 text-xs leading-5 text-muted-foreground">No photos or documents attached to this case.</p>;
  }
  return <ul className="mt-3 space-y-2">
    {documents.map((document, index) => {
      const href = document.url ?? document.path ?? document.object_path ?? "";
      const filename = document.filename ?? href.split("/").pop() ?? `Attachment ${index + 1}`;
      const isPhoto = document.content_type?.startsWith("image/");
      return <li key={document.id ?? href} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
        <span className="flex min-w-0 items-center gap-2 text-xs"><FileText className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="truncate">{filename}</span></span>
        <a href={href} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold text-primary underline-offset-4 hover:underline">{isPhoto ? "Open photo" : "Open document"}</a>
      </li>;
    })}
  </ul>;
}

export function ConnectCaseDetail() {
  const [, clientParams] = useRoute("/my-cases/:id");
  const [, advocateParams] = useRoute("/advocate/cases/:id");
  const [, setLocation] = useLocation();
  const isAdvocateView = !!advocateParams?.id;
  const params = advocateParams ?? clientParams;
  const caseId = Number(params?.id);
  const { user } = useAuth();
  const isAdvocate = user?.role === "lawyer" || user?.role === "advocate";
  const canEdit = isAdvocateView && isAdvocate;
  const { lang } = useLanguage();
  const copy = connectV2Strings(lang);
  const flagsQuery = useConnectFlags();
  const queryClient = useQueryClient();
  const [nextStep, setNextStep] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [latestUpdate, setLatestUpdate] = useState("");
  const [docLabel, setDocLabel] = useState("");
  const [message, setMessage] = useState("");
  const initializedForCase = useRef<number | null>(null);
  const caseListKey = isAdvocateView ? ["connect-v2-advocate-cases", user?.id] : ["connect-v2-cases-mine", user?.id];
  const casesQuery = useQuery<CaseListResponse>({
    queryKey: caseListKey,
    queryFn: () => apiFetch(isAdvocateView ? "/connect-v2/advocate/cases" : "/connect-v2/cases/mine") as Promise<CaseListResponse>,
    enabled: !!user && Number.isFinite(caseId) && (isAdvocateView ? isAdvocate : user.role === "client"),
  });
  const current = casesFromResponse(casesQuery.data).find((item) => item.id === caseId);
  const attachedDocuments = current ? caseDocuments(current) : [];
  const requestedDocuments = current?.requested_documents ?? [];
  useEffect(() => {
    if (!current || initializedForCase.current === current.id) return;
    initializedForCase.current = current.id;
    setNextStep(current.next_step ?? "");
    setNextDate(current.next_step_date?.slice(0, 10) ?? "");
    setLatestUpdate(current.latest_update ?? "");
  }, [current]);
  const update = useMutation({
    mutationFn: () => {
      if (!canEdit) throw new Error("Only the assigned advocate can update this case.");
      return apiFetch(`/connect-v2/cases/${caseId}/update`, { method: "PATCH", body: { next_step: nextStep, next_step_date: nextDate || null, latest_update: latestUpdate } });
    },
    onSuccess: () => {
      setMessage("Case update saved.");
      queryClient.invalidateQueries({ queryKey: caseListKey });
    },
    onError: (failure: Error) => setMessage(failure.message),
  });
  const addDocument = useMutation({
    mutationFn: () => {
      if (!canEdit) throw new Error("Only the assigned advocate can request documents.");
      return apiFetch(`/connect-v2/cases/${caseId}/documents`, { method: "POST", body: { label: docLabel.trim() } });
    },
    onSuccess: () => {
      setDocLabel(""); setMessage("Document request sent.");
      queryClient.invalidateQueries({ queryKey: caseListKey });
    },
    onError: (failure: Error) => setMessage(failure.message),
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-7 sm:px-7 sm:pt-10">
      <button type="button" onClick={() => setLocation(isAdvocateView ? "/advocate/cases" : "/my-cases")} className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />All cases</button>
      {casesQuery.isLoading && <div className="space-y-3"><div className="h-24 animate-pulse rounded-2xl bg-muted" /><div className="h-60 animate-pulse rounded-2xl bg-muted" /></div>}
      {casesQuery.isError && <div className={`${cardClass} p-6`}><ConnectAlert>{(casesQuery.error as Error).message}</ConnectAlert><Button className="mt-4" variant="outline" onClick={() => casesQuery.refetch()}>Retry</Button></div>}
      {user && ((isAdvocateView && !isAdvocate) || (!isAdvocateView && user.role !== "client")) && <div className={`${cardClass} p-8 text-center`}>
        <h1 className="text-xl font-semibold">This case view is not available for this account</h1>
        <p className="mt-2 text-sm text-muted-foreground">{isAdvocateView ? "Accepted advocate cases are only available to advocates." : "Client case details are only available to the client who posted them."}</p>
        <Button className="mt-5" variant="outline" onClick={() => setLocation(isAdvocate ? "/advocate/cases" : "/my-cases")}>Back to cases</Button>
      </div>}
      {!casesQuery.isLoading && !casesQuery.isError && !current && !(user && ((isAdvocateView && !isAdvocate) || (!isAdvocateView && user.role !== "client"))) && <div className={`${cardClass} p-8 text-center`}><h1 className="text-xl font-semibold">Case not found</h1><p className="mt-2 text-sm text-muted-foreground">This case is not available in your account.</p><Button className="mt-5" variant="outline" onClick={() => setLocation(isAdvocateView ? "/advocate/cases" : "/my-cases")}>Back to cases</Button></div>}
      {current && <div>
        <ConnectHeader eyebrow={`Case file · ${current.status.replace(/_/g, " ")}`} title={current.problem_type} description={`Case #${current.id}${current.location ? ` · ${current.location}` : ""} · written in ${languageName(current.language)}`} />
        {!isAdvocateView && <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs leading-5 text-muted-foreground"><p>{copy.noRanking}</p><p className="mt-1">{copy.noCommission}</p></div>}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(270px,.65fr)]">
          <div className="space-y-4">
            <section className={`${cardClass} p-5 sm:p-6`}>
              <div className="mb-4 flex items-center gap-2 text-sm font-bold"><FileText className="h-4 w-4 text-primary" />Your description</div>
              <p lang={current.language} dir={["ur", "sd"].includes(current.language) ? "rtl" : "ltr"} style={current.language === "ur" || current.language === "sd" ? { fontFamily: '"Noto Nastaliq Urdu", serif' } : undefined} className="whitespace-pre-wrap text-sm leading-7">{current.description}</p>
              {flagsQuery.data?.multilang && <div className="mt-5"><TranslationReadingView text={current.description} sourceLanguage={current.language} /></div>}
              {current.voice_transcript && <div className="mt-5 rounded-xl border border-border bg-muted/35 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold"><Mic className="h-3.5 w-3.5 text-primary" />Voice-note transcript · {languageName(current.voice_language || current.language)}</div>
                <p lang={current.voice_language || current.language} dir={["ur", "sd"].includes(current.voice_language || current.language) ? "rtl" : "ltr"} className="mt-2 whitespace-pre-wrap text-sm leading-7">{current.voice_transcript}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">Transcript text is preserved as entered. Check it against the original audio.</p>
              </div>}
            </section>
            <section className={`${cardClass} p-5 sm:p-6`}>
              <div className="mb-5 flex items-center gap-2 text-sm font-bold"><CalendarDays className="h-4 w-4 text-primary" />Next step & update</div>
              {canEdit ? <form onSubmit={(event) => { event.preventDefault(); setMessage(""); update.mutate(); }} className="space-y-4">
                <div><label htmlFor="next-step" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Next step</label><input id="next-step" data-testid="input-next-step" className={inputClass} value={nextStep} onChange={(event) => setNextStep(event.target.value)} maxLength={500} placeholder="For example, gather the sale agreement" /></div>
                <div><label htmlFor="next-step-date" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Target date</label><input id="next-step-date" data-testid="input-next-step-date" className={inputClass} type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} /></div>
                <div><label htmlFor="latest-update" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Latest update</label><textarea id="latest-update" data-testid="input-latest-update" className={`${inputClass} min-h-24 resize-y`} value={latestUpdate} onChange={(event) => setLatestUpdate(event.target.value)} maxLength={2000} placeholder="Add an update for this case…" /></div>
                {message && <ConnectAlert tone={update.isError || addDocument.isError ? "error" : "success"}>{message}</ConnectAlert>}
                <Button type="submit" disabled={update.isPending} data-testid="button-save-case-update">{update.isPending ? "Saving…" : "Save update"}</Button>
              </form> : <div className="space-y-4">
                <div><p className="text-xs font-semibold text-muted-foreground">Next step</p><p className="mt-1 text-sm leading-6">{current.next_step || "No next step has been added yet."}</p>{current.next_step && flagsQuery.data?.multilang && <TranslationReadingView text={current.next_step} sourceLanguage={current.latest_update_language || "en"} />}</div>
                {current.next_step_date && <div><p className="text-xs font-semibold text-muted-foreground">Target date</p><p className="mt-1 text-sm">{new Date(current.next_step_date).toLocaleDateString()}</p></div>}
                {current.latest_update && <div className="border-t border-border pt-4"><p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />Latest update</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{current.latest_update}</p>{flagsQuery.data?.multilang && <div className="mt-4"><TranslationReadingView text={current.latest_update} sourceLanguage={current.latest_update_language || "en"} /></div>}</div>}
              </div>}
            </section>
          </div>

          <aside className="space-y-4">
            <section className={`${cardClass} p-5`}>
              <div className="flex items-center gap-2 text-sm font-bold"><UserRound className="h-4 w-4 text-primary" />Advocate</div>
              {isAdvocateView
                ? <p className="mt-3 text-sm leading-6 text-muted-foreground">You are the assigned advocate for this accepted case.</p>
                : current.advocate ? <div className="mt-4">
                <div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{current.advocate.name}</p><p className="mt-1 text-xs text-muted-foreground">{current.advocate.experience_years} years' experience</p></div>
                  {current.advocate.verification_status === "verified" && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-800/10 px-2 py-1 text-[10px] font-semibold text-emerald-800 dark:text-emerald-200"><BadgeCheck className="h-3 w-3" />Verified</span>}
                </div>
                {current.advocate.practice_areas?.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{current.advocate.practice_areas.map((area) => <span key={area} className="rounded-full border border-border px-2.5 py-1 text-[10px] text-muted-foreground">{area}</span>)}</div>}
              </div> : <p className="mt-3 text-sm leading-6 text-muted-foreground">No advocate has been connected yet. Your request remains visible to eligible advocates.</p>}
              {!isAdvocateView && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {current.advocate?.phone
                  ? <a href={`tel:${current.advocate.phone}`} className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90" data-testid="button-call-advocate"><Phone className="mr-2 h-4 w-4" />{copy.phone}</a>
                  : <Button variant="outline" disabled data-testid="button-call-advocate"><Phone className="mr-2 h-4 w-4" />{copy.phone}</Button>}
                <Button variant="outline" disabled={!current.thread_id} onClick={() => current.thread_id && setLocation(`/messages?thread=${encodeURIComponent(String(current.thread_id))}`)} data-testid="button-open-messages"><MessageSquareText className="mr-2 h-4 w-4" />{copy.messages}</Button>
              </div>}
            </section>
            <section className={`${cardClass} p-5`}>
              <div className="flex items-center gap-2 text-sm font-bold"><Paperclip className="h-4 w-4 text-primary" />{copy.documents}</div>
              <ConnectDocumentLinks documents={attachedDocuments} />
            </section>
            <section className={`${cardClass} p-5`}>
              <div className="flex items-center gap-2 text-sm font-bold"><FileText className="h-4 w-4 text-primary" />Requested documents</div>
              {requestedDocuments.length === 0
                ? <p className="mt-3 text-xs leading-5 text-muted-foreground">No documents requested yet.</p>
                : <ul className="mt-3 space-y-2">{requestedDocuments.map((document) => <li key={document.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/45 px-3 py-2 text-xs"><span>{document.label}</span><span className="shrink-0 rounded-full bg-background px-2 py-1 text-[10px] text-muted-foreground">{document.status.replace(/_/g, " ")}</span></li>)}</ul>}
              {canEdit && <form className="mt-5 space-y-2.5 border-t border-border pt-4" onSubmit={(event) => { event.preventDefault(); setMessage(""); addDocument.mutate(); }}>
                <p className="text-xs leading-5 text-muted-foreground">Request a document from the client. The client can upload it securely to the case.</p>
                <input aria-label="Document request" data-testid="input-document-label" className={inputClass} value={docLabel} onChange={(event) => setDocLabel(event.target.value)} placeholder="What document is needed?" maxLength={140} required />
                <Button type="submit" variant="outline" className="w-full" disabled={addDocument.isPending || !docLabel.trim()} data-testid="button-add-document">{addDocument.isPending ? "Sending request…" : "Request document"}</Button>
              </form>}
              {canEdit && message && <div className="mt-3"><ConnectAlert tone={addDocument.isError ? "error" : "success"}>{message}</ConnectAlert></div>}
            </section>
          </aside>
        </div>
      </div>}
    </main>
  );
}

export function ConnectAdvocateCases() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const flags = useConnectFlags();
  const isAdvocate = user?.role === "lawyer" || user?.role === "advocate";
  const query = useQuery<CaseListResponse>({
    queryKey: ["connect-v2-advocate-cases", user?.id],
    queryFn: () => apiFetch("/connect-v2/advocate/cases") as Promise<CaseListResponse>,
    enabled: !!user && isAdvocate && !!flags.data?.connect_v2,
  });
  const cases = casesFromResponse(query.data);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-7 sm:px-7 sm:pt-10">
      <ConnectHeader eyebrow="Advocate workspace" title="Accepted cases" description="Follow through on the matters you accepted, keep clients informed, and request documents when needed." />
      {!isAdvocate && <div className={`${cardClass} p-7`}><h2 className="font-semibold">Advocate access required</h2><p className="mt-1 text-sm text-muted-foreground">Accepted cases are only available to an advocate on the case.</p></div>}
      {isAdvocate && !flags.isLoading && !flags.data?.connect_v2 && <div className={`${cardClass} p-7`}><h2 className="font-semibold">Connect is not enabled</h2><p className="mt-1 text-sm text-muted-foreground">The accepted case workspace is not available for this account.</p></div>}
      {isAdvocate && (flags.isLoading || query.isLoading) && <div className="space-y-3" aria-label="Loading accepted cases"><div className="h-32 animate-pulse rounded-2xl bg-muted" /><div className="h-32 animate-pulse rounded-2xl bg-muted" /></div>}
      {isAdvocate && query.isError && <div className={`${cardClass} p-7 text-center`}><p className="font-semibold">Accepted cases could not be loaded</p><p className="mt-1 text-sm text-muted-foreground">{(query.error as Error).message}</p><Button className="mt-4" variant="outline" onClick={() => query.refetch()}>Try again</Button></div>}
      {isAdvocate && !flags.isLoading && !!flags.data?.connect_v2 && !query.isLoading && !query.isError && cases.length === 0 && <div className={`${cardClass} connect-surface px-6 py-14 text-center`}>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><BriefcaseBusiness className="h-6 w-6" /></div>
        <h2 className="mt-5 text-xl font-semibold">No accepted cases yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Once you accept a request, it will be listed here for updates and document requests.</p>
        <Button className="mt-6" onClick={() => setLocation("/requests")}>Review requests<ArrowRight className="ml-2 h-4 w-4" /></Button>
      </div>}
      {isAdvocate && !!flags.data?.connect_v2 && !query.isLoading && !query.isError && cases.length > 0 && <div className="space-y-3">
        {cases.map((item) => <button key={item.id} type="button" onClick={() => setLocation(`/advocate/cases/${item.id}`)} className={`${cardClass} group w-full p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg`} data-testid={`card-advocate-case-${item.id}`}>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{item.problem_type}</span><span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{item.status.replace(/_/g, " ")}</span><span className="text-xs text-muted-foreground">Case #{item.id}</span></div>
              <p className="mt-3 line-clamp-2 text-sm leading-6">{item.description}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {item.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{item.location}</span>}
                <span className="inline-flex items-center gap-1"><Languages className="h-3.5 w-3.5" />{languageName(item.language)}</span>
                {(item.requested_documents?.length ?? 0) > 0 && <span className="inline-flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" />{item.requested_documents?.length} document requests</span>}
              </div>
              {item.next_step && <p className="mt-4 border-l-2 border-primary/60 pl-3 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Next:</strong> {item.next_step}</p>}
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2">Open case<ArrowRight className="h-3.5 w-3.5 transition-all" /></span>
          </div>
        </button>)}
      </div>}
      {isAdvocate && <Button className="mt-6" variant="outline" onClick={() => setLocation("/requests")}>Requests</Button>}
    </main>
  );
}

export function AdvocateRequests() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const flagsQuery = useConnectFlags();
  const isAdvocate = user?.role === "lawyer" || user?.role === "advocate";
  const [notice, setNotice] = useState("");
  const query = useQuery<{ requests: ConnectRequest[] }>({
    queryKey: ["connect-v2-requests", user?.id],
    queryFn: () => apiFetch("/connect-v2/requests") as Promise<{ requests: ConnectRequest[] }>,
    enabled: !!user && isAdvocate && !!flagsQuery.data?.connect_v2,
  });
  const response = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "accept" | "decline" }) => apiFetch(`/connect-v2/requests/${id}/${action}`, { method: "POST" }),
    onSuccess: (_, variables) => {
      setNotice(variables.action === "accept" ? "Request accepted. The case is now part of your connections." : "Request declined.");
      queryClient.invalidateQueries({ queryKey: ["connect-v2-requests", user?.id] });
    },
    onError: (failure: Error) => setNotice(failure.message),
  });
  const requests = query.data?.requests ?? [];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-7 sm:px-7 sm:pt-10">
      <ConnectHeader eyebrow="Advocate workspace" title="Requests" description="Review case requests and choose which matters you can take on. There are no paid placements." />
      {isAdvocate && <div className="mb-4"><Button variant="outline" onClick={() => setLocation("/advocate/cases")}><BriefcaseBusiness className="mr-2 h-4 w-4" />Accepted cases</Button></div>}
      {!isAdvocate && <div className={`${cardClass} p-7`}><h2 className="font-semibold">Advocate access required</h2><p className="mt-1 text-sm text-muted-foreground">Requests are only available to advocates.</p></div>}
      <div className="mb-5 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs leading-5 text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" />Clients' names are hidden at this stage. Accepting opens a direct connection; it does not imply a paid referral.</div>
      {notice && <div className="mb-4"><ConnectAlert tone={response.isError ? "error" : "success"}>{notice}</ConnectAlert></div>}
      {isAdvocate && (flagsQuery.isLoading || query.isLoading) && <div className="space-y-3"><div className="h-40 animate-pulse rounded-2xl bg-muted" /><div className="h-40 animate-pulse rounded-2xl bg-muted" /></div>}
      {isAdvocate && !flagsQuery.isLoading && !flagsQuery.data?.connect_v2 && <div className={`${cardClass} p-7`}>
        <h2 className="font-semibold">Requests are not enabled for this account</h2>
        <p className="mt-1 text-sm text-muted-foreground">The legacy advocate workspace remains available while Connect is rolled out.</p>
        <Button className="mt-4" variant="outline" onClick={() => setLocation("/matches")}>Go to legacy requests</Button>
      </div>}
      {isAdvocate && query.isError && <div className={`${cardClass} p-7 text-center`}><p className="font-semibold">Requests could not be loaded</p><p className="mt-1 text-sm text-muted-foreground">{(query.error as Error).message}</p><Button className="mt-4" variant="outline" onClick={() => query.refetch()}>Try again</Button></div>}
      {isAdvocate && !flagsQuery.isLoading && !!flagsQuery.data?.connect_v2 && !query.isLoading && !query.isError && requests.length === 0 && <div className={`${cardClass} connect-surface px-6 py-14 text-center`}>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><BriefcaseBusiness className="h-6 w-6" /></div>
        <h2 className="mt-5 text-xl font-semibold">No new requests</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">New client requests will appear here. You decide whether a matter fits your practice.</p>
      </div>}
      {isAdvocate && !flagsQuery.isLoading && !!flagsQuery.data?.connect_v2 && !query.isLoading && !query.isError && requests.length > 0 && <div className="space-y-3">
        {requests.map((request) => <article key={request.id} className={`${cardClass} overflow-hidden`} data-testid={`card-advocate-request-${request.id}`}>
          <div className="p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{request.problem_type}</span><span className="text-xs text-muted-foreground">Request #{request.id}</span></div>
                <h2 className="mt-3 text-lg font-semibold tracking-tight">{request.problem_type} matter</h2>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{new Date(request.posted_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{request.summary}</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
              {request.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{request.location}</span>}
              <span className="inline-flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" />{request.document_count} {request.document_count === 1 ? "document" : "documents"}</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Client identity hidden</span>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/20 p-4 sm:flex-row sm:justify-end">
            <Button variant="outline" disabled={response.isPending} onClick={() => { if (window.confirm("Decline this request? It will be removed from your request list.")) response.mutate({ id: request.id, action: "decline" }); }} data-testid={`button-decline-request-${request.id}`}><X className="mr-2 h-4 w-4" />Decline</Button>
            <Button disabled={response.isPending} onClick={() => response.mutate({ id: request.id, action: "accept" })} data-testid={`button-accept-request-${request.id}`}><Check className="mr-2 h-4 w-4" />{response.isPending ? "Saving…" : "Accept request"}</Button>
          </div>
        </article>)}
      </div>}
    </main>
  );
}
