import { useState, useCallback, useEffect, useRef } from "react";
import {
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import { motion, AnimatePresence } from "framer-motion";
import ForgeCanvas from "@/components/workspace/ForgeCanvas";
import ForgeTour, { checkForgeToured } from "@/components/workspace/ForgeTour";
import { useAuth } from "@/lib/auth-context";
import AgentPanel, { type AgentState, type CollabEvent } from "@/components/workspace/AgentPanel";
import { RELATIONSHIP_TYPES, type RelType } from "@/components/workspace/EdgeTypes";
import ProactivePanel, { type Suggestion } from "@/components/workspace/ProactivePanel";
import PersonalTwinPanel, { type TwinProfile, type CrossMatterData } from "@/components/workspace/PersonalTwinPanel";
import SimulationPanel, { type SimState, type SimulationResult, type NodeDelta } from "@/components/workspace/SimulationPanel";
import SearchPanel from "@/components/workspace/SearchPanel";
import { LangToggle, STRINGS, getInitialLang, type Lang } from "@/components/workspace/WorkspaceLang";
import { NoSessionWelcome, EmptyCanvasGuide } from "@/components/workspace/ForgeWelcome";
import { ToastStack, type ForgeToastItem } from "@/components/workspace/ForgeToast";
import { layoutWithDagre } from "@/components/workspace/canvasLayout";
import ConnectionHintsTray, { type ConnectionHint } from "@/components/workspace/ConnectionHintsTray";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkspaceSession {
  id: number;
  title: string;
  case_description: string;
  nodes_json: Node[];
  edges_json: Edge[];
  insights: unknown[];
  updated_at: string;
}

interface SearchResult {
  nodes: Node[];
  source: string;
  total: number;
}

const BASE = "/litigaforge";
const TOKEN_KEY = "lf_token";

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem(TOKEN_KEY) || "";
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(opts.headers as Record<string, string> | undefined),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/login";
    throw new Error("Session expired — please sign in again.");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res;
}

// ─── Smart node placement — avoids stacking on existing nodes ─────────────────

function findOpenPosition(existing: { position: { x: number; y: number } }[]): { x: number; y: number } {
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 5; col++) {
      const x = 120 + col * 270;
      const y = 110 + row * 180;
      const blocked = existing.some(n => Math.abs(n.position.x - x) < 230 && Math.abs(n.position.y - y) < 155);
      if (!blocked) return { x, y };
    }
  }
  const last = existing[existing.length - 1];
  return last ? { x: last.position.x + 290, y: last.position.y } : { x: 200, y: 200 };
}

// ─── Node presets for manual "Add Node" ───────────────────────────────────────

const NODE_PRESETS: Record<string, { type: string; emoji: string; data: Record<string, unknown> }> = {
  judgment: { type: "judgment", emoji: "⚖️", data: { label: "New Judgment",   court: "Court",  summary: "",  impact_score: 75, citation: "" } },
  fact:     { type: "fact",     emoji: "📋", data: { label: "New Fact",        content: "",     impact_score: 70 } },
  issue:    { type: "issue",    emoji: "🏛️", data: { label: "Legal Issue",     description: "", impact_score: 80 } },
  argument: { type: "argument", emoji: "🗣️", data: { label: "New Argument",    content: "",     strength: 75, impact_score: 75 } },
  risk:     { type: "risk",     emoji: "⚠️", data: { label: "Risk Factor",     description: "", severity: 5,  impact_score: 50 } },
  strategy: { type: "strategy", emoji: "💡", data: { label: "New Strategy",    description: "", confidence: 75, impact_score: 75 } },
};

const AGENT_IDS = ["research", "strategy", "risk", "drafting", "predictive"];

// ─── Demo matter: Family Pension Claim (Lalitha Devi v. State of Telangana) ──

const DEMO_CASE_DESCRIPTION = "Family pension claim for the widow of a deceased Telangana State government employee (35 years' service). Pension rejected on procedural grounds — Form-5 filed 7 days beyond the 90-day window. Seeking quashing of the rejection order and direction to release pension with arrears before CAT Hyderabad Bench under Rule 54, CCS (Pension) Rules 1972.";

const DEMO_NODES: Node[] = [
  { id: "df1", type: "fact",     position: { x: 120,  y: 110 }, data: { label: "Deceased Employee — 35 Yrs Service", content: "Mr. Ramu Reddy, Section Officer, Telangana Revenue Dept. Died in service Aug 2023. Wife Lalitha Devi nominated as family pension beneficiary in his service records (Form-2).", impact_score: 85 } },
  { id: "df2", type: "fact",     position: { x: 390,  y: 110 }, data: { label: "Pension Rejected — Procedural Delay", content: "Dept. rejected Form-5 (family pension claim) because it was filed 97 days after the date of death — 7 days beyond the prescribed 90-day window under Rule 80(5) CCS (Pension) Rules.", impact_score: 80 } },
  { id: "di1", type: "issue",    position: { x: 660,  y: 110 }, data: { label: "Core Legal Issue — Rule 54 vs. Procedural Bar", description: "Whether a 7-day procedural delay in filing Form-5 can extinguish the statutory right to family pension vested under Rule 54 of CCS (Pension) Rules, 1972 read with Article 300-A of the Constitution of India.", impact_score: 93 } },
  { id: "da1", type: "argument", position: { x: 120,  y: 290 }, data: { label: "Pension Is Property — Cannot Be Forfeited", content: "Under Art. 300-A, pension is property. A procedural delay of 7 days does not justify forfeiture of a substantive constitutional right. Supported by D.S. Nakara v. Union of India (1983).", strength: 88, impact_score: 90 } },
  { id: "da2", type: "argument", position: { x: 390,  y: 290 }, data: { label: "No SCN Issued — Natural Justice Violated", content: "Department denied pension without issuing a Show Cause Notice or any opportunity to explain the 7-day delay. Rejection ex-parte squarely violates the audi alteram partem principle.", strength: 79, impact_score: 81 } },
  { id: "dr1", type: "risk",     position: { x: 660,  y: 290 }, data: { label: "Limitation Risk — OA May Be Time-Barred", description: "If the formal rejection letter was issued more than 3 years ago, the Original Application before CAT may face a limitation objection under Section 21 of the Administrative Tribunals Act, 1985.", severity: 6, impact_score: 50 } },
  { id: "ds1", type: "strategy", position: { x: 120,  y: 470 }, data: { label: "File OA Before CAT Hyderabad Bench", description: "File Original Application under Section 19 of the Administrative Tribunals Act. Primary prayer: quash the rejection order. Alternative prayer: direct release of pension with 6% p.a. interest on arrears. Annex PPO, Form-2 nomination, and rejection letter.", confidence: 82, impact_score: 85 } },
  { id: "dj1", type: "judgment", position: { x: 390,  y: 470 }, data: { label: "State of Jharkhand v. Jitendra Kumar Srivastava", court: "Supreme Court of India", summary: "Pension is not a bounty — it is a hard-earned statutory right. Procedural lapses cannot defeat it. Courts must adopt a liberal construction in favour of the pensioner.", impact_score: 94, citation: "(2013) 2 SCC 114" } },
  { id: "dj2", type: "judgment", position: { x: 660,  y: 470 }, data: { label: "D.S. Nakara v. Union of India", court: "Supreme Court of India", summary: "Pension is earned by years of service; it is a property right under Art. 300-A. Rules arbitrarily curtailing it are constitutionally suspect.", impact_score: 89, citation: "(1983) 1 SCC 305" } },
];

const DEMO_EDGES: Edge[] = [
  { id: "de-f1-i1", source: "df1", target: "di1", type: "default", animated: true },
  { id: "de-f2-i1", source: "df2", target: "di1", type: "default", animated: true },
  { id: "de-i1-a1", source: "di1", target: "da1", type: "default", animated: false },
  { id: "de-i1-a2", source: "di1", target: "da2", type: "default", animated: false },
  { id: "de-i1-r1", source: "di1", target: "dr1", type: "default", animated: false },
  { id: "de-a1-j1", source: "da1", target: "dj1", type: "default", animated: false },
  { id: "de-a1-j2", source: "da1", target: "dj2", type: "default", animated: false },
  { id: "de-a1-s1", source: "da1", target: "ds1", type: "default", animated: false },
  { id: "de-a2-s1", source: "da2", target: "ds1", type: "default", animated: false },
  { id: "de-j1-s1", source: "dj1", target: "ds1", type: "default", animated: false },
];

function makeDefaultAgentStates(): Record<string, AgentState> {
  return Object.fromEntries(AGENT_IDS.map(id => [id, { status: "idle" as const, text: "" }]));
}

// ─── Connection hint similarity ────────────────────────────────────────────────

const HINT_STOPWORDS = new Set([
  "the","of","and","in","a","an","is","to","with","by","for","on","at","or",
  "v.","vs","that","this","which","from","under","such","any","all","has",
  "had","have","been","not","was","are","were","but","its","their",
]);

function computeConnectionHints(newNode: Node, existing: Node[]): ConnectionHint[] {
  const d         = newNode.data as Record<string, unknown>;
  const summary   = String(d.summary || d.label || "").toLowerCase();
  const actscited = Array.isArray(d.actscited) ? (d.actscited as string[]) : [];
  const newKws    = summary.split(/\W+/).filter(w => w.length > 3 && !HINT_STOPWORDS.has(w));

  const scored: Array<{ node: Node; score: number }> = [];
  for (const n of existing) {
    if (n.id === newNode.id || n.hidden || n.type === "cluster") continue;
    const nd   = n.data as Record<string, unknown>;
    const text = [nd.label, nd.content, nd.description, nd.summary]
      .filter(Boolean).join(" ").toLowerCase();
    let score = 0;
    for (const kw of newKws) if (text.includes(kw)) score++;
    for (const act of actscited) if (text.includes(act.toLowerCase())) score += 2;
    if (score > 0) scored.push({ node: n, score });
  }
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 3).map(({ node }) => {
    const relType: RelType =
      node.type === "argument" ? "supports" :
      node.type === "risk"     ? "questions" : "cites";
    return {
      sourceId:    node.id,
      sourceLabel: String((node.data as Record<string, unknown>).label || ""),
      relType,
    };
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ForgeWorkspace() {
  const [sessions, setSessions]             = useState<WorkspaceSession[]>([]);
  const [sessionId, setSessionId]           = useState<number | null>(null);
  const [sessionTitle, setSessionTitle]     = useState("Untitled Workspace");
  const [caseDescription, setCaseDescription] = useState("");
  const [nodes, setNodes, onNodesChange]    = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange]    = useEdgesState<Edge>([]);
  const [agentStates, setAgentStates]       = useState<Record<string, AgentState>>(makeDefaultAgentStates);
  const [isAnalyzing, setIsAnalyzing]       = useState(false);
  const [isSaving, setIsSaving]             = useState(false);
  const [showAddMenu, setShowAddMenu]       = useState(false);
  const [rightPanelTab, setRightPanelTab]   = useState<"sessions" | "search" | "simulate" | "insights" | "twin">("sessions");
  const [simState, setSimState]             = useState<SimState>({ phase: "idle", scenario: "", before: null, after: null, deltas: [], analysis: "", agents: [] });
  const [simHistory, setSimHistory]         = useState<SimulationResult[]>([]);
  const [suggestions, setSuggestions]       = useState<Suggestion[]>([]);
  const [isLoadingInsights, setIsLoadingInsights]   = useState(false);
  const [autoInsightCtx, setAutoInsightCtx]         = useState<string | null>(null);
  const [openAskForAgentId, setOpenAskForAgentId]   = useState<string | null>(null);
  const [collabFeed, setCollabFeed]         = useState<CollabEvent[]>([]);
  const [synthesisScore, setSynthesisScore] = useState<number | null>(null);
  const [twinProfile, setTwinProfile]       = useState<TwinProfile | null>(null);
  const [crossMatter, setCrossMatter]       = useState<CrossMatterData | null>(null);
  const [isLoadingTwin, setIsLoadingTwin]   = useState(false);
  const [showTour, setShowTour]             = useState(false);
  const [lang, setLang]                     = useState<Lang>(getInitialLang);
  const [toasts, setToasts]                 = useState<ForgeToastItem[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sessionSearch, setSessionSearch]   = useState("");
  const [fitViewTrigger, setFitViewTrigger] = useState(0);
  const [connectionHints, setConnectionHints] = useState<ConnectionHint[]>([]);
  const [hintNewNodeId, setHintNewNodeId]   = useState<string | null>(null);
  const t = STRINGS[lang];

  const [isMobile, setIsMobile]           = useState(() => window.innerWidth < 768);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [mobileSheet, setMobileSheet]     = useState<"agent" | "sessions" | "search" | "insights" | "simulate" | "twin" | null>(null);

  function addToast(item: Omit<ForgeToastItem, "id">) {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev.slice(-5), { ...item, id }]);
  }
  function dismissToast(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  const { user, logout } = useAuth();

  const saveTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addMenuRef          = useRef<HTMLDivElement>(null);
  const historyRef          = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const histIdxRef          = useRef<number>(-1);
  const simAfterSummaryRef  = useRef<string>("");
  const prevNodeScoresRef   = useRef<Map<string, number>>(new Map());
  const flashTimersRef      = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // ─── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  async function loadSessions() {
    setIsLoadingSessions(true);
    try {
      const res  = await api("/workspace/sessions");
      const list = await res.json() as WorkspaceSession[];
      setSessions(list);
      if (list.length > 0) {
        await openSession(list[0]);
      }
      // If no sessions, stay on welcome screen so user can choose blank or demo
    } catch {
      addToast({ type: "error", message: "Failed to load workspaces", detail: "Check your connection and refresh." });
    } finally {
      setIsLoadingSessions(false);
    }
  }

  async function createSession(title = "Untitled Workspace") {
    try {
      const res = await api("/workspace/sessions", {
        method: "POST",
        body: JSON.stringify({ title, case_description: "" }),
      });
      const s = await res.json() as WorkspaceSession;
      setSessions(prev => [s, ...prev]);
      setSessionId(s.id);
      setSessionTitle(s.title);
      setCaseDescription(s.case_description || "");
      setNodes([]);
      setEdges([]);
      setAgentStates(makeDefaultAgentStates());
    } catch {
      addToast({ type: "error", message: "Could not create workspace", detail: "Check your connection and try again." });
    }
  }

  async function createDemoSession() {
    try {
      const res = await api("/workspace/sessions", {
        method: "POST",
        body: JSON.stringify({
          title: "Family Pension Claim — Lalitha Devi v. State of Telangana",
          case_description: DEMO_CASE_DESCRIPTION,
        }),
      });
      const s = await res.json() as WorkspaceSession;
      // Persist demo canvas immediately so it survives a reload
      void api(`/workspace/sessions/${s.id}`, {
        method: "PUT",
        body: JSON.stringify({ nodes_json: DEMO_NODES, edges_json: DEMO_EDGES, case_description: DEMO_CASE_DESCRIPTION }),
      }).catch(() => {});
      setSessions(prev => [s, ...prev]);
      setSessionId(s.id);
      setSessionTitle(s.title);
      setCaseDescription(DEMO_CASE_DESCRIPTION);
      setNodes(DEMO_NODES);
      setEdges(DEMO_EDGES);
      setAgentStates(makeDefaultAgentStates());
      addToast({
        type: "success",
        message: "Demo matter loaded!",
        detail: "Family Pension canvas is ready. Click ⚡ Analyze to run the 5 AI agents.",
      });
    } catch {
      addToast({ type: "error", message: "Could not load demo workspace", detail: "Check your connection and try again." });
    }
  }

  async function openSession(s: WorkspaceSession) {
    try {
      const res  = await api(`/workspace/sessions/${s.id}`);
      const full = await res.json() as WorkspaceSession;
      setSessionId(full.id);
      setSessionTitle(full.title);
      setCaseDescription(full.case_description || "");
      setNodes((full.nodes_json as Node[]) || []);
      setEdges((full.edges_json as Edge[]) || []);
      setAgentStates(makeDefaultAgentStates());
      // Reset session-scoped state so stale data from previous session doesn't bleed through
      setCollabFeed([]);
      setSynthesisScore(null);
      setSuggestions([]);
      setSimState({ phase: "idle", scenario: "", before: null, after: null, deltas: [], analysis: "", agents: [] });
      // Load saved agent feedback for this session (non-critical)
      try {
        const fbRes = await api(`/workspace/sessions/${full.id}/feedback`);
        if (fbRes.ok) {
          const fb = await fbRes.json() as Record<string, "up" | "down">;
          if (Object.keys(fb).length > 0) {
            setAgentStates(prev => {
              const next = { ...prev };
              for (const [agentId, vote] of Object.entries(fb)) {
                if (next[agentId]) next[agentId] = { ...next[agentId], feedback: vote };
              }
              return next;
            });
          }
        }
      } catch { /* feedback load is non-critical */ }
    } catch {
      addToast({ type: "error", message: "Failed to open workspace", detail: "The session may have been deleted." });
    }
  }

  // ─── Auto-save canvas (debounced 2s) ─────────────────────────────────────────

  useEffect(() => {
    if (!sessionId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveCanvas(true);
    }, 2000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [nodes, edges, sessionId]);

  async function saveCanvas(silent = false) {
    if (!sessionId) return;
    if (!silent) setIsSaving(true);
    try {
      await api(`/workspace/sessions/${sessionId}/canvas`, {
        method: "PUT",
        body: JSON.stringify({ nodes, edges }),
      });
    } catch {
      if (!silent) addToast({ type: "error", message: "Save failed", detail: "Changes are queued — will retry on next edit." });
    } finally {
      if (!silent) setIsSaving(false);
    }
  }

  async function saveTitle() {
    if (!sessionId) return;
    try {
      await api(`/workspace/sessions/${sessionId}`, {
        method: "PUT",
        body: JSON.stringify({ title: sessionTitle, case_description: caseDescription }),
      });
      // Reflect title change immediately in the session list card
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, title: sessionTitle, case_description: caseDescription } : s
      ));
    } catch {
      addToast({ type: "warning", message: "Workspace name not saved", detail: "Title changes may not persist." });
    }
  }

  async function deleteSession(id: number) {
    await api(`/workspace/sessions/${id}`, { method: "DELETE" }).catch(() => {});
    const remaining = sessions.filter(s => s.id !== id);
    setSessions(remaining);
    if (id === sessionId) {
      // Clear all session-scoped state before switching
      setSimState({ phase: "idle", scenario: "", before: null, after: null, deltas: [], analysis: "", agents: [] });
      setSuggestions([]);
      setCollabFeed([]);
      setSynthesisScore(null);
      if (remaining.length > 0) {
        void openSession(remaining[0]);
      } else {
        void createSession();
      }
    }
  }

  // ─── History (undo / redo) ────────────────────────────────────────────────────

  function pushHistory(ns: Node[], es: Edge[]) {
    const h = historyRef.current.slice(0, histIdxRef.current + 1);
    h.push({ nodes: ns, edges: es });
    historyRef.current = h.slice(-50);
    histIdxRef.current = historyRef.current.length - 1;
    setCanUndo(histIdxRef.current > 0);
    setCanRedo(false);
  }

  function undo() {
    if (histIdxRef.current <= 0) return;
    histIdxRef.current--;
    const snap = historyRef.current[histIdxRef.current];
    setNodes(snap.nodes);
    setEdges(snap.edges);
    setCanUndo(histIdxRef.current > 0);
    setCanRedo(true);
  }

  function redo() {
    if (histIdxRef.current >= historyRef.current.length - 1) return;
    histIdxRef.current++;
    const snap = historyRef.current[histIdxRef.current];
    setNodes(snap.nodes);
    setEdges(snap.edges);
    setCanUndo(true);
    setCanRedo(histIdxRef.current < historyRef.current.length - 1);
  }

  function deleteSelectedNodes() {
    pushHistory([...nodes], [...edges]);
    const removedIds = new Set(nodes.filter(n => n.selected).map(n => n.id));
    setNodes(ns => ns.filter(n => !n.selected));
    setEdges(es => es.filter(e => !e.selected && !removedIds.has(e.source) && !removedIds.has(e.target)));
  }

  function propagateImpact(currentEdges: Edge[]) {
    const flashedIds: string[] = [];
    setNodes(ns => {
      const updated = ns.map(n => ({ ...n, data: { ...(n.data as Record<string, unknown>) } }));
      const idxMap  = new Map(updated.map((n, i) => [n.id, i]));
      for (const e of currentEdges) {
        const si = idxMap.get(e.source);
        const ti = idxMap.get(e.target);
        if (si === undefined || ti === undefined) continue;
        const srcScore = Number((updated[si].data as Record<string, unknown>).impact_score ?? 70);
        const d        = updated[ti].data as Record<string, unknown>;
        const tgtScore = Number(d.impact_score ?? 70);
        const rel      = ((e.data as Record<string, unknown>)?.relType as string) ?? "";
        let delta = 0;
        if (rel === "supports")         delta =  Math.round(srcScore * 0.08);
        else if (rel === "cites")       delta =  5;
        else if (rel === "contradicts") delta = -10;
        if (delta !== 0) {
          updated[ti] = {
            ...updated[ti],
            data: {
              ...d,
              impact_score: Math.min(100, Math.max(5, tgtScore + delta)),
              impactFlash:  delta > 0 ? "positive" : "negative",
            },
          };
          flashedIds.push(updated[ti].id);
        }
      }
      // Clear flash after 1.6 s — mirrors simHighlight clear pattern
      if (flashedIds.length > 0) {
        setTimeout(() => {
          setNodes(prev => prev.map(n => {
            if (!flashedIds.includes(n.id)) return n;
            const { impactFlash: _f, ...rest } = n.data as Record<string, unknown>;
            return { ...n, data: rest };
          }));
        }, 1600);
      }
      return updated;
    });
  }

  // ─── Canvas connection (typed) ────────────────────────────────────────────────

  const onConnectTyped = useCallback((connection: Connection, relType: string) => {
    const rel = RELATIONSHIP_TYPES[relType as RelType] ?? RELATIONSHIP_TYPES.cites;
    const newEdge: Edge = {
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      source:       connection.source ?? "",
      target:       connection.target ?? "",
      sourceHandle: connection.sourceHandle ?? null,
      targetHandle: connection.targetHandle ?? null,
      type: "labeled",
      data: { relType, label: rel.label, color: rel.color },
      style: { stroke: rel.color, strokeWidth: 1.5, strokeDasharray: rel.dash ? "6 3" : undefined },
      animated: !rel.dash,
    };
    pushHistory([...nodes], [...edges]);
    setEdges(eds => addEdge(newEdge, eds));
    setTimeout(() => propagateImpact([...edges, newEdge]), 80);
  }, [nodes, edges, setEdges]);

  const onEdgeTypeChange = useCallback((edgeId: string, relType: string) => {
    const rel = RELATIONSHIP_TYPES[relType as RelType] ?? RELATIONSHIP_TYPES.cites;
    pushHistory([...nodes], [...edges]);
    setEdges(eds => eds.map(e => e.id !== edgeId ? e : {
      ...e,
      data:  { relType, label: rel.label, color: rel.color },
      style: { stroke: rel.color, strokeWidth: 1.5, strokeDasharray: rel.dash ? "6 3" : undefined },
      animated: !rel.dash,
    }));
  }, [nodes, edges, setEdges]);

  // ─── Add node manually ────────────────────────────────────────────────────────

  function addNode(type: string) {
    const preset = NODE_PRESETS[type];
    if (!preset) return;
    const id = `${type}-${Date.now()}`;
    const newNode: Node = {
      id,
      type,
      position: findOpenPosition(nodes),
      data: { ...preset.data },
    };
    pushHistory([...nodes], [...edges]);
    setNodes(prev => [...prev, newNode]);
    setShowAddMenu(false);
    // Fire learning event (fire-and-forget)
    if (sessionId) {
      void api("/workspace/profile/event", {
        method: "POST",
        body: JSON.stringify({ event_type: "node_add", session_id: sessionId, data: { node_type: type } }),
      }).catch(() => {});
    }
  }

  // ─── Search panel callback ────────────────────────────────────────────────────

  const onSearchNodesAdded = useCallback((newNodes: Node[]) => {
    if (!newNodes.length) return;
    pushHistory([...nodes], [...edges]);
    // Compute deduplicated count for toast feedback
    const existingIdSet = new Set(nodes.map(n => n.id));
    const addedCount = newNodes.filter(n => !existingIdSet.has(n.id)).length;
    setNodes(prev => {
      const existingIds = new Set(prev.map(n => n.id));
      let placed = [...prev];
      const deduped = newNodes
        .filter(n => !existingIds.has(n.id))
        .map(n => {
          const pos = findOpenPosition(placed);
          placed = [...placed, { ...n, position: pos }];
          return { ...n, position: pos };
        });
      return [...prev, ...deduped];
    });
    if (addedCount > 0) {
      addToast({
        type: "info",
        message: `${addedCount} judgment${addedCount > 1 ? "s" : ""} added to canvas`,
        duration: 3000,
      });
    }
    // Smart connection hints: surface top-3 related nodes for new judgments
    const newJudgments = newNodes.filter(n => n.type === "judgment");
    if (newJudgments.length > 0) {
      const hints = computeConnectionHints(newJudgments[0], nodes);
      if (hints.length > 0) {
        setConnectionHints(hints);
        setHintNewNodeId(newJudgments[0].id);
      }
    }
    // Fire judgment_add learning events — read response for cross-matter judgment hits (Step 3)
    if (sessionId) {
      for (const n of newNodes.filter(n => n.type === "judgment")) {
        const d = n.data as Record<string, unknown>;
        void (async () => {
          try {
            const evtRes = await api("/workspace/profile/event", {
              method: "POST",
              body: JSON.stringify({
                event_type: "judgment_add",
                session_id: sessionId,
                data: { court: d.court ?? "", title: (d.label ?? "").toString().slice(0, 80) },
              }),
            });
            const evtData = await evtRes.json() as {
              cross_matter_hit?: { session_id: number; session_title: string; judgment_title: string } | null;
            };
            if (evtData.cross_matter_hit) {
              const hit = evtData.cross_matter_hit;
              setSuggestions(prev => {
                const deduped = prev.filter(s => !(s.type === "cross_matter" && s.sessionId === hit.session_id));
                return [
                  {
                    id: `cm-jdg-${Date.now()}`,
                    type: "cross_matter" as const,
                    emoji: "🔗",
                    text: `"${hit.judgment_title.slice(0, 45)}" also in "${hit.session_title.slice(0, 35)}"`,
                    detail: "This judgment was used in another matter — open it to reuse its arguments.",
                    sessionId: hit.session_id,
                  },
                  ...deduped.slice(0, 9),
                ];
              });
            }
          } catch { /* non-critical */ }
        })();
      }
    }
  }, [nodes, edges, setNodes, sessionId]);

  // ─── Multi-agent analysis (SSE) ──────────────────────────────────────────────

  const runAnalysis = useCallback(async () => {
    if (!sessionId || isAnalyzing) return;
    setIsAnalyzing(true);
    setAgentStates(makeDefaultAgentStates());
    setCollabFeed([]);
    setSynthesisScore(null);

    // Local counters — avoids stale closure from captured state values
    let localDoneCount    = 0;
    let localSynthesisScore: number | null = null;

    try {
      const res = await fetch(`${BASE}/workspace/sessions/${sessionId}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ case_description: caseDescription }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const dataLine = block.split("\n").find(l => l.startsWith("data: "));
          if (!dataLine) continue;
          try {
            const event = JSON.parse(dataLine.slice(6)) as Record<string, unknown>;
            const type    = event.type as string;
            const agentId = event.agent as string;

            if (type === "agent_start") {
              setAgentStates(prev => ({
                ...prev,
                [agentId]: { status: "thinking", text: "", reasoning: undefined, canvasNodeAdded: false },
              }));
            } else if (type === "agent_reasoning") {
              setAgentStates(prev => ({
                ...prev,
                [agentId]: { ...(prev[agentId] ?? { status: "thinking", text: "" }), reasoning: event.reasoning as string },
              }));
            } else if (type === "agent_token") {
              setAgentStates(prev => ({
                ...prev,
                [agentId]: {
                  ...(prev[agentId] ?? { status: "thinking", text: "" }),
                  status: "thinking",
                  text: (prev[agentId]?.text ?? "") + (event.token as string),
                },
              }));
            } else if (type === "agent_done") {
              const sn = event.suggested_node as Node | undefined;
              setAgentStates(prev => ({
                ...prev,
                [agentId]: {
                  ...(prev[agentId] ?? { status: "thinking", text: "" }),
                  status: "done",
                  text:            event.full_text as string,
                  reasoning:       (event.reasoning as string | undefined) || prev[agentId]?.reasoning,
                  canvasNodeAdded: !!sn,
                },
              }));
              if (sn) {
                setNodes(prev => {
                  if (prev.find(n => n.id === sn.id)) return prev;
                  // Place using grid layout to avoid overlap
                  const placed = { ...sn, position: findOpenPosition(prev) };
                  return [...prev, placed as Node];
                });
              }
              localDoneCount++;
            } else if (type === "agent_consult") {
              setCollabFeed(prev => [...prev, {
                from:      event.from as string,
                to:        event.to as string,
                message:   event.message as string,
                timestamp: Date.now(),
              }]);
            } else if (type === "agent_agree") {
              const a     = event.a as string;
              const b     = event.b as string;
              const label = event.label as string;
              setAgentStates(prev => ({
                ...prev,
                [a]: { ...(prev[a] ?? { status: "done", text: "" }), agreesWith: { agentId: b, label } },
                [b]: { ...(prev[b] ?? { status: "done", text: "" }), agreesWith: { agentId: a, label } },
              }));
            } else if (type === "agent_disagree") {
              const a     = event.a as string;
              const b     = event.b as string;
              const label = event.label as string;
              setAgentStates(prev => ({
                ...prev,
                [a]: { ...(prev[a] ?? { status: "done", text: "" }), conflictsWith: { agentId: b, label } },
                [b]: { ...(prev[b] ?? { status: "done", text: "" }), conflictsWith: { agentId: a, label } },
              }));
            } else if (type === "agent_synthesis") {
              const score = event.consensus_score as number;
              setSynthesisScore(score);
              localSynthesisScore = score;
              // Auto-trigger proactive insights 1.5s after synthesis completes
              setTimeout(() => setAutoInsightCtx("agent_synthesis"), 1500);
            }
          } catch { /* malformed event */ }
        }
      }
      // Use locally tracked counters — avoids stale closure reading idle state
      addToast({
        type: "success",
        message: `Analysis complete — ${localDoneCount}/5 agents`,
        detail: localSynthesisScore !== null ? `Consensus score: ${localSynthesisScore}/100` : "Canvas nodes updated.",
        duration: 5000,
      });
    } catch {
      addToast({
        type: "error",
        message: "Analysis stream interrupted",
        detail: "LLM provider may be busy. Wait a moment and try again.",
        duration: 7000,
      });
    } finally {
      setIsAnalyzing(false);
    }
  // agentStates / synthesisScore intentionally excluded — local counters track them during the stream
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isAnalyzing, caseDescription]);

  // ─── What-If Simulation (SSE) ────────────────────────────────────────────────

  const runSimulation = useCallback(async (assumption: string) => {
    if (!sessionId || !assumption.trim() || simState.phase === "running") return;
    setSimState({ phase: "running", scenario: assumption, before: null, after: null, deltas: [], analysis: "", agents: [] });
    try {
      const res = await fetch(`${BASE}/workspace/sessions/${sessionId}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ assumption, case_description: caseDescription, nodes }),
      });
      if (!res.ok || !res.body) throw new Error("Stream failed");
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let localScoreChange: number | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const blocks = buf.split("\n\n");
        buf = blocks.pop() ?? "";
        for (const block of blocks) {
          const line = block.split("\n").find(l => l.startsWith("data: "));
          if (!line) continue;
          try {
            const ev    = JSON.parse(line.slice(6)) as Record<string, unknown>;
            const etype = ev.type as string;
            if (etype === "sim_before") {
              setSimState(p => ({ ...p, before: { avgScore: ev.avg_score as number, riskLevel: ev.risk_level as string, nodeCount: ev.node_count as number } }));
            } else if (etype === "sim_agent") {
              setSimState(p => ({ ...p, agents: [...new Set([...p.agents, ev.agent as string])] }));
            } else if (etype === "sim_token") {
              setSimState(p => ({ ...p, analysis: p.analysis + (ev.token as string) }));
            } else if (etype === "sim_delta") {
              const deltas = ev.deltas as NodeDelta[];
              setSimState(p => ({ ...p, deltas }));
              // Amber-highlight affected nodes, auto-clear after 2 s
              setNodes(prev => prev.map(n => {
                const lbl = String((n.data as Record<string, unknown>).label ?? "");
                const hit = deltas.some(d => d.nodeLabel.toLowerCase() === lbl.toLowerCase());
                return hit ? { ...n, data: { ...(n.data as Record<string, unknown>), simHighlight: true } } : n;
              }));
              setTimeout(() => {
                setNodes(prev => prev.map(n => {
                  const d = n.data as Record<string, unknown>;
                  if (!d.simHighlight) return n;
                  const { simHighlight: _sh, ...rest } = d;
                  return { ...n, data: rest };
                }));
              }, 2000);
            } else if (etype === "sim_after") {
              const afterSummary = ev.summary as string;
              localScoreChange = ev.score_change as number;
              simAfterSummaryRef.current = afterSummary;
              setSimState(p => ({
                ...p,
                after: {
                  avgScore:        ev.avg_score      as number,
                  riskLevel:       ev.risk_level     as string,
                  scoreChange:     localScoreChange as number,
                  summary:         afterSummary,
                  recommendation:  ev.recommendation as string,
                },
              }));
            } else if (etype === "sim_complete") {
              setSimState(p => ({ ...p, phase: "complete" }));
              // Auto-trigger proactive insights with sim context after 1.5 s
              const ctx = assumption + (simAfterSummaryRef.current ? ` → ${simAfterSummaryRef.current}` : "");
              setTimeout(() => setAutoInsightCtx(ctx.slice(0, 400)), 1500);
            }
          } catch { /* malformed */ }
        }
      }
      // Toast on completion — mirrors pattern in runAnalysis
      const changeStr = localScoreChange !== null
        ? `Score ${localScoreChange >= 0 ? "+" : ""}${localScoreChange.toFixed(0)} pts — AI insights refresh shortly.`
        : "Canvas updated. Check the Simulation tab.";
      addToast({ type: "success", message: "⚡ Simulation complete", detail: changeStr, duration: 5000 });
    } catch {
      setSimState(p => ({ ...p, phase: "complete" }));
    }
    // addToast intentionally excluded from deps — follows existing pattern
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, caseDescription, nodes, simState.phase]);

  const onSaveSimulation = useCallback(() => {
    setSimState(prev => {
      if (!prev.before || !prev.after) return prev;
      const result: SimulationResult = {
        id:        Date.now().toString(),
        scenario:  prev.scenario,
        timestamp: Date.now(),
        before:    prev.before,
        after:     prev.after,
        deltas:    prev.deltas,
      };
      setSimHistory(h => [...h.slice(-4), result]);
      return prev;
    });
  }, []);

  const onApplyToCanvas = useCallback((result: SimulationResult) => {
    setNodes(prev => prev.map(n => {
      const delta = result.deltas.find(d => (n.data as Record<string, unknown>).label === d.nodeLabel);
      if (!delta) return n;
      return { ...n, data: { ...(n.data as Record<string, unknown>), impact_score: delta.newScore } };
    }));
  }, [setNodes]);

  // ─── Proactive Insights ───────────────────────────────────────────────────────

  const fetchInsights = useCallback(async (ctx = "") => {
    if (!sessionId || isLoadingInsights) return;
    setIsLoadingInsights(true);
    try {
      const res = await api(`/workspace/sessions/${sessionId}/insights`, {
        method: "POST",
        body: JSON.stringify({ case_description: caseDescription, nodes, context: ctx }),
      });
      const data = await res.json() as { suggestions: Suggestion[] };
      const apiSuggestions = data.suggestions ?? [];

      // Inject cross-matter connections as cross_matter suggestions (top 2)
      const cmSuggestions: Suggestion[] = (crossMatter?.connections ?? []).slice(0, 2).map(c => ({
        id:        `cm-${c.session_id}`,
        type:      "cross_matter" as const,
        emoji:     "🗂️",
        text:      `Similar matter: "${c.title}"`,
        detail:    `Shared topics: ${c.shared_topics.slice(0, 3).join(", ")}. Open this matter to review reusable arguments and precedents.`,
        sessionId: c.session_id,
      }));

      setSuggestions([...cmSuggestions, ...apiSuggestions]);
      if (ctx && (apiSuggestions.length + cmSuggestions.length) > 0) {
        const n = apiSuggestions.length + cmSuggestions.length;
        addToast({ type: "info", message: `✨ ${n} AI insight${n > 1 ? "s" : ""} refreshed`, duration: 3000 });
      }
    } catch { /* keep existing */ } finally {
      setIsLoadingInsights(false);
    }
    // addToast is stable — intentionally excluded from deps (established pattern)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, caseDescription, nodes, isLoadingInsights, crossMatter]);

  const onAcceptSuggestion = useCallback((s: Suggestion) => {
    // cross_matter: navigate to the linked session
    if (s.type === "cross_matter") {
      if (s.sessionId != null) {
        void openSession({ id: s.sessionId, title: "", case_description: "", nodes_json: [], edges_json: [], insights: [], updated_at: "" });
      }
      setSuggestions(prev => prev.filter(x => x.id !== s.id));
      return;
    }
    // agent_rec type: dispatch a custom event to launch the agent ask panel
    if (s.type === "agent_rec") {
      const parts   = s.emoji.trim().split(/\s+/);
      const agentId = parts[parts.length - 1] || "research";
      window.dispatchEvent(new CustomEvent("lf-launch-agent-ask", { detail: { agentId, question: s.text } }));
      setSuggestions(prev => prev.filter(x => x.id !== s.id));
      if (isMobile) setMobileSheet("agent");
      return;
    }
    const typeMap: Record<string, string> = { opportunity: "strategy", risk: "risk", precedent: "judgment", pattern: "argument", warning: "fact", step: "argument", framework: "strategy" };
    const nodeType = typeMap[s.type] ?? "strategy";
    const preset   = NODE_PRESETS[nodeType];
    if (!preset) return;
    pushHistory([...nodes], [...edges]);
    setNodes(prev => [...prev, {
      id:       `insight-${Date.now()}`,
      type:     nodeType,
      position: findOpenPosition(nodes),
      data:     { ...preset.data, label: s.text.slice(0, 50), description: s.detail ?? s.text, impact_score: 75 },
    } as Node]);
    setSuggestions(prev => prev.filter(x => x.id !== s.id));
    // Fire learning event
    if (sessionId) {
      void api("/workspace/profile/event", {
        method: "POST",
        body: JSON.stringify({
          event_type: "suggestion_accept",
          session_id: sessionId,
          data: { suggestion_type: s.type, suggestion_text: s.text.slice(0, 100) },
        }),
      }).catch(() => {});
    }
  }, [nodes, edges, setNodes, sessionId, isMobile]);

  const onDismissSuggestion = useCallback((id: string) => {
    const s = suggestions.find(x => x.id === id);
    setSuggestions(prev => prev.filter(x => x.id !== id));
    if (sessionId && s) {
      void api("/workspace/profile/event", {
        method: "POST",
        body: JSON.stringify({
          event_type: "suggestion_dismiss",
          session_id: sessionId,
          data: { suggestion_type: s.type },
        }),
      }).catch(() => {});
    }
  }, [suggestions, sessionId]);

  // ─── Direct agent Q&A (SSE) ───────────────────────────────────────────────────

  const onAskAgent = useCallback(async (agentId: string, question: string) => {
    if (!sessionId) return;
    setAgentStates(prev => ({
      ...prev,
      [agentId]: {
        ...(prev[agentId] ?? { status: "done", text: "" }),
        askQuestion:  question,
        askResponse:  "",
        askStreaming:  true,
      },
    }));
    try {
      const res = await fetch(`${BASE}/workspace/sessions/${sessionId}/agent/${agentId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ question, case_description: caseDescription }),
      });
      if (!res.ok || !res.body) throw new Error("Stream failed");
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const blocks = buf.split("\n\n");
        buf = blocks.pop() ?? "";
        for (const block of blocks) {
          const line = block.split("\n").find(l => l.startsWith("data: "));
          if (!line) continue;
          try {
            const ev = JSON.parse(line.slice(6)) as Record<string, unknown>;
            if (ev.type === "token") {
              setAgentStates(prev => ({
                ...prev,
                [agentId]: {
                  ...(prev[agentId] ?? { status: "done", text: "" }),
                  askResponse: (prev[agentId]?.askResponse ?? "") + (ev.token as string),
                },
              }));
            }
          } catch { /* malformed */ }
        }
      }
    } catch { /* stream error — leave askStreaming: false */ }
    setAgentStates(prev => ({
      ...prev,
      [agentId]: { ...(prev[agentId] ?? { status: "done", text: "" }), askStreaming: false },
    }));
  }, [sessionId, caseDescription]);

  // Step 5 helper: detect drafting-agent template from output text (mirrors SECTION_KEYS["drafting"])
  const _detectDraftTemplate = (text: string): string => {
    for (const key of ["LEGAL CONTENTION", "SUPPORTING AUTHORITIES", "PRAYER"]) {
      if (text.includes(key + ":")) return key;
    }
    return "full";
  };

  const onFeedback = useCallback((agentId: string, vote: "up" | "down") => {
    setAgentStates(prev => {
      const newVote = prev[agentId]?.feedback === vote ? null : vote;
      // Persist to dedicated feedback endpoint (DB-backed, survives reloads)
      if (sessionId && newVote) {
        void api(`/workspace/sessions/${sessionId}/agent/${agentId}/feedback`, {
          method: "POST",
          body: JSON.stringify({ vote: newVote }),
        }).catch(() => {});
      }
      // Step 5: Emit draft_reject when user downvotes the drafting agent
      if (agentId === "drafting" && vote === "down" && sessionId && prev["drafting"]?.text) {
        const text = prev["drafting"].text ?? "";
        const wc = text.split(/\s+/).filter(Boolean).length;
        const wcb = wc < 200 ? "short" : wc < 500 ? "medium" : "long";
        void api("/workspace/profile/event", {
          method: "POST",
          body: JSON.stringify({
            event_type: "draft_reject",
            session_id: sessionId,
            data: {
              agent_id: agentId,
              section: "full",
              template_type: _detectDraftTemplate(text),
              word_count_bucket: wcb,
            },
          }),
        }).catch(() => {});
      }
      return {
        ...prev,
        [agentId]: {
          ...(prev[agentId] ?? { status: "done", text: "" }),
          feedback: newVote,
        },
      };
    });
    // Also emit profile event for twin learning
    if (sessionId) {
      void api("/workspace/profile/event", {
        method: "POST",
        body: JSON.stringify({
          event_type: "agent_feedback",
          session_id: sessionId,
          data: { agent_id: agentId, vote },
        }),
      }).catch(() => {});
    }
  }, [sessionId]);

  // Step 4: Reactivate a suppressed suggestion type (undo suppress)
  // Fires event then manually re-fetches twin profile so the UI updates immediately
  const onReactivateSuggestionType = useCallback((type: string) => {
    if (!sessionId) return;
    void api("/workspace/profile/event", {
      method: "POST",
      body: JSON.stringify({
        event_type: "suggestion_reactivate",
        session_id: sessionId,
        data: { suggestion_type: type },
      }),
    }).then(async () => {
      // Re-fetch twin profile so Reduced Visibility section updates
      const [profRes, cmRes] = await Promise.all([
        api("/workspace/profile"),
        api(`/workspace/sessions/${sessionId}/cross-matter`),
      ]);
      const [prof, cm] = await Promise.all([profRes.json(), cmRes.json()]);
      setTwinProfile(prof as TwinProfile);
      setCrossMatter(cm as CrossMatterData);
    }).catch(() => {});
  }, [sessionId]);

  // Step 5: Draft copy tracking — logs draft_accept with template_type + word_count_bucket
  const onDraftCopy = useCallback((agentId: string, templateType: string, wordCountBucket: string) => {
    if (!sessionId) return;
    void api("/workspace/profile/event", {
      method: "POST",
      body: JSON.stringify({
        event_type: "draft_accept",
        session_id: sessionId,
        data: { agent_id: agentId, section: "full", template_type: templateType, word_count_bucket: wordCountBucket },
      }),
    }).catch(() => {});
  }, [sessionId]);

  // ─── Auto-fetch insights when switching to insights tab ───────────────────────

  useEffect(() => {
    if (rightPanelTab === "insights" && sessionId && suggestions.length === 0 && !isLoadingInsights) {
      void fetchInsights();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rightPanelTab, sessionId]);

  // ─── Auto-trigger insights (after synthesis / simulation) ────────────────────

  useEffect(() => {
    if (autoInsightCtx === null) return;
    const ctx = autoInsightCtx;
    setAutoInsightCtx(null);
    void fetchInsights(ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoInsightCtx]);

  // ─── lf-launch-agent-ask custom event listener ───────────────────────────────

  useEffect(() => {
    function handleLaunchAgent(e: Event) {
      const { agentId, question } = (e as CustomEvent<{ agentId: string; question?: string }>).detail;
      // Open the ask UI for this agent immediately (force-open)
      setOpenAskForAgentId(agentId);
      // Clear the force-open flag after 2s so the agent card returns to normal control
      setTimeout(() => setOpenAskForAgentId(null), 2000);
      if (question) {
        void onAskAgent(agentId, question);
      }
    }
    window.addEventListener("lf-launch-agent-ask", handleLaunchAgent);
    return () => window.removeEventListener("lf-launch-agent-ask", handleLaunchAgent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAskAgent]);

  // ─── Cluster expand custom event ─────────────────────────────────────────────

  useEffect(() => {
    function handler(e: Event) {
      const { clusterId } = (e as CustomEvent<{ clusterId: string }>).detail;
      handleExpandCluster(clusterId);
    }
    window.addEventListener("lf-cluster-expand", handler);
    return () => window.removeEventListener("lf-cluster-expand", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  // ─── Ctrl+G keyboard shortcut for grouping ───────────────────────────────────

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "g" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          const selectedCluster = nodes.find(n => n.selected && n.type === "cluster");
          if (selectedCluster) handleExpandCluster(selectedCluster.id);
        } else {
          handleGroupSelection();
        }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  // ─── Score-change impact flash (visual-only — score scrubber & agent updates) ─

  useEffect(() => {
    const prevScores = prevNodeScoresRef.current;
    const nextScores = new Map<string, number>();
    const changedNodeIds: string[] = [];

    for (const n of nodes) {
      const score = Number((n.data as Record<string, unknown>).impact_score ?? 0);
      nextScores.set(n.id, score);
      const prev = prevScores.get(n.id);
      if (prev !== undefined && prev !== score) changedNodeIds.push(n.id);
    }
    prevNodeScoresRef.current = nextScores;
    if (changedNodeIds.length === 0) return;

    // First-degree neighbours of all changed nodes
    const changedSet  = new Set(changedNodeIds);
    const neighborIds = new Set<string>();
    for (const e of edges) {
      if (changedSet.has(e.source) && !changedSet.has(e.target)) neighborIds.add(e.target);
      if (changedSet.has(e.target) && !changedSet.has(e.source)) neighborIds.add(e.source);
    }
    if (neighborIds.size === 0) return;

    // Average delta → flash direction
    const totalDelta = changedNodeIds.reduce((sum, id) => {
      const cur  = nextScores.get(id) ?? 0;
      const prev = prevScores.get(id) ?? cur;
      return sum + (cur - prev);
    }, 0);
    const flash: "positive" | "negative" = totalDelta >= 0 ? "positive" : "negative";
    const ids = [...neighborIds];

    // Cancel existing timers for these nodes (avoid double-flash on rapid edits)
    for (const id of ids) {
      const existing = flashTimersRef.current.get(id);
      if (existing) { clearTimeout(existing); flashTimersRef.current.delete(id); }
    }

    // Visual-only flash — no impact_score mutation
    setNodes(prev => prev.map(n => {
      if (!neighborIds.has(n.id)) return n;
      return { ...n, data: { ...(n.data as Record<string, unknown>), impactFlash: flash } };
    }));

    // Clear after 1.6 s
    const tid = setTimeout(() => {
      setNodes(prev => prev.map(n => {
        if (!ids.includes(n.id)) return n;
        const { impactFlash: _f, ...rest } = n.data as Record<string, unknown>;
        return { ...n, data: rest };
      }));
      for (const id of ids) flashTimersRef.current.delete(id);
    }, 1600);
    for (const id of ids) flashTimersRef.current.set(id, tid);
  // edges is read via closure intentionally — flash fires on score change, not edge change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  // ─── Personal Legal Twin — fetch profile + cross-matter ───────────────────────

  const fetchTwinData = useCallback(async () => {
    if (!sessionId || isLoadingTwin) return;
    setIsLoadingTwin(true);
    try {
      const [profRes, crossRes, summaryRes] = await Promise.all([
        api("/workspace/profile"),
        api(`/workspace/sessions/${sessionId}/cross-matter`),
        api("/workspace/profile/summary"),
      ]);
      const prof    = await profRes.json() as TwinProfile;
      const summary = (await summaryRes.json()) as { insights: Array<{ emoji: string; text: string }> };
      setTwinProfile({ ...prof, summary_insights: summary.insights ?? [] });
      setCrossMatter(await crossRes.json() as CrossMatterData);
    } catch { /* keep existing profile */ } finally {
      setIsLoadingTwin(false);
    }
  }, [sessionId, isLoadingTwin]);

  useEffect(() => {
    if (rightPanelTab === "twin" && sessionId && !twinProfile && !isLoadingTwin) {
      void fetchTwinData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rightPanelTab, sessionId]);

  const onToggleLearning = useCallback(async (enabled: boolean) => {
    try {
      await api("/workspace/profile/settings", {
        method: "PUT",
        body: JSON.stringify({ learning_enabled: enabled }),
      });
      setTwinProfile(prev => prev ? { ...prev, learning_enabled: enabled } : prev);
    } catch {
      addToast({ type: "error", message: "Could not update learning settings." });
    }
  }, []);

  const onResetProfile = useCallback(async () => {
    try {
      await api("/workspace/profile/reset", { method: "DELETE" });
      setTwinProfile(null);
      setCrossMatter(null);
      addToast({ type: "success", message: "Learning data reset." });
    } catch {
      addToast({ type: "error", message: "Could not reset learning data." });
    }
  }, []);

  // ─── Canvas layout / grouping ─────────────────────────────────────────────────

  function handleAutoLayout() {
    if (nodes.filter(n => !n.hidden).length < 2) return;
    pushHistory([...nodes], [...edges]);
    setNodes(layoutWithDagre(nodes, edges));
    setFitViewTrigger(t => t + 1);
  }

  function handleGroupSelection() {
    const selected = nodes.filter(n => n.selected && n.type !== "cluster");
    if (selected.length < 2) {
      addToast({ type: "warning", message: "Select 2+ nodes to group (Ctrl+G)", duration: 2500 });
      return;
    }
    const cx = selected.reduce((s, n) => s + n.position.x, 0) / selected.length;
    const cy = selected.reduce((s, n) => s + n.position.y, 0) / selected.length;
    const memberIds   = selected.map(n => n.id);
    const memberIdSet = new Set(memberIds);
    const externalEdges = edges.filter(e =>
      (memberIdSet.has(e.source) && !memberIdSet.has(e.target)) ||
      (!memberIdSet.has(e.source) && memberIdSet.has(e.target))
    );
    const typeCounts: Record<string, number> = {};
    selected.forEach(n => { const t = n.type ?? "node"; typeCounts[t] = (typeCounts[t] ?? 0) + 1; });
    const clusterId = `cluster-${Date.now()}`;
    const proxyEdges: Edge[] = externalEdges.map(e => {
      const srcIsMember = memberIdSet.has(e.source);
      return {
        id:     `proxy-${e.id}`,
        source:  srcIsMember ? clusterId : e.source,
        target:  srcIsMember ? e.target  : clusterId,
        type:   "labeled",
        data:    e.data,
        style:   e.style,
        animated: e.animated ?? false,
      } as Edge;
    });
    const clusterNode: Node = {
      id:       clusterId,
      type:     "cluster",
      position: { x: cx, y: cy },
      data: {
        label:                 `Group (${selected.length})`,
        memberIds,
        typeCounts,
        originalExternalEdges: externalEdges,
        proxyEdgeIds:          proxyEdges.map(e => e.id),
      },
    };
    pushHistory([...nodes], [...edges]);
    setNodes(prev => [
      ...prev.map(n => memberIdSet.has(n.id) ? { ...n, hidden: true, selected: false } : n),
      clusterNode,
    ]);
    setEdges(prev => [
      ...prev.filter(e => !externalEdges.some(xe => xe.id === e.id)),
      ...proxyEdges,
    ]);
    addToast({ type: "info", message: `${selected.length} nodes grouped — Ctrl+Shift+G to ungroup`, duration: 3500 });
  }

  function handleExpandCluster(clusterId: string) {
    const clusterNode = nodes.find(n => n.id === clusterId);
    if (!clusterNode) return;
    const d = clusterNode.data as Record<string, unknown>;
    const memberIds             = (d.memberIds as string[]) ?? [];
    const proxyEdgeIds          = new Set((d.proxyEdgeIds as string[]) ?? []);
    const originalExternalEdges = (d.originalExternalEdges as Edge[]) ?? [];
    const memberIdSet           = new Set(memberIds);
    pushHistory([...nodes], [...edges]);
    setNodes(prev => prev
      .filter(n => n.id !== clusterId)
      .map(n => memberIdSet.has(n.id) ? { ...n, hidden: false } : n)
    );
    setEdges(prev => [
      ...prev.filter(e => !proxyEdgeIds.has(e.id)),
      ...originalExternalEdges,
    ]);
    addToast({ type: "info", message: "Group expanded.", duration: 2000 });
  }

  // ─── Show first-visit tour when a session is first loaded ────────────────────

  const tourShownRef = useRef(false);
  useEffect(() => {
    if (sessionId && !tourShownRef.current && !checkForgeToured()) {
      tourShownRef.current = true;
      const tid = setTimeout(() => setShowTour(true), 1200);
      return () => clearTimeout(tid);
    }
    return undefined;
  }, [sessionId]);

  // ─── Close add menu on outside click ──────────────────────────────────────────

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as HTMLElement)) {
        setShowAddMenu(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── Flush canvas on tab close (avoids losing 2-s debounce window) ──────────

  useEffect(() => {
    function handleUnload() {
      if (!sessionId) return;
      const token = localStorage.getItem(TOKEN_KEY) || "";
      // keepalive: true allows the request to outlive the page
      fetch(`${BASE}/workspace/sessions/${sessionId}/canvas`, {
        method: "PUT",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ nodes, edges }),
      }).catch(() => {});
    }
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [sessionId, nodes, edges]);

  // ─── Dark theme CSS vars override ────────────────────────────────────────────

  useEffect(() => {
    // Ensure the workspace dark bg overrides the layout light bg on scroll containers
    document.body.style.setProperty("--workspace-active", "1");
    return () => {
      document.body.style.removeProperty("--workspace-active");
    };
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────────

  const FG = "#e2e8f0";
  const FGD = "#94a3b8";
  const BG  = "#070d1a";
  const PANEL = "rgba(8,16,36,0.97)";
  const BORDER = "rgba(20,184,166,0.12)";
  const TEAL  = "#14b8a6";

  return (
    <>
    <div
      data-testid="forge-workspace"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: "calc(100vh - 56px)",
        background: BG,
        color: FG,
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    >
      {/* ── Toolbar ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: isMobile ? 6 : 8,
        padding: isMobile ? "0 10px" : "0 14px",
        height: 52,
        flexShrink: 0,
        position: "relative",
        overflow: "visible",
        background: PANEL,
        borderBottom: `1px solid ${BORDER}`,
        zIndex: 10,
      }}>
        {/* Desktop: collapse agent panel */}
        {!isMobile && (
          <button
            onClick={() => setLeftCollapsed(v => !v)}
            title={leftCollapsed ? "Expand agent panel" : "Collapse agent panel"}
            style={{ ...toolbarBtn(false), padding: "5px 8px", fontSize: 12, flexShrink: 0 }}
          >
            {leftCollapsed ? "▶" : "◀"}
          </button>
        )}

        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: isMobile ? 0 : 6, flexShrink: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "linear-gradient(135deg, rgba(20,184,166,0.2), rgba(14,116,144,0.12))",
            border: "1px solid rgba(20,184,166,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15,
            boxShadow: "0 0 12px rgba(20,184,166,0.15)",
          }}>
            ⚡
          </div>
          {!isMobile && (
            <div>
              <div style={{
                fontWeight: 900, fontSize: 11.5, letterSpacing: "0.06em",
                background: "linear-gradient(90deg, #14b8a6, #22d3ee)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                {t.brand}
              </div>
              <div style={{ fontSize: 7.5, color: "#64748b", letterSpacing: "0.08em", marginTop: -1, fontWeight: 700 }}>
                {t.brandSub}
              </div>
            </div>
          )}
        </div>

        {/* Session title */}
        <input
          value={sessionTitle}
          onChange={e => setSessionTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={e => e.key === "Enter" && saveTitle()}
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 7,
            padding: "5px 10px",
            fontSize: isMobile ? 11 : 12,
            color: FG,
            fontWeight: 600,
            outline: "none",
            width: isMobile ? 100 : 200,
            minWidth: 0,
            flexShrink: 1,
          }}
        />

        <div style={{ flex: 1 }} />

        {/* Add node — desktop only */}
        {!isMobile && (
        <div ref={addMenuRef} style={{ position: "relative" }}>
          <button
            onClick={() => setShowAddMenu(v => !v)}
            data-testid="forge-add-node"
            style={toolbarBtn(showAddMenu)}
          >
            {t.addNode}
          </button>
          {showAddMenu && (
            <div style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              background: "rgba(8,18,44,0.98)",
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              padding: "6px",
              zIndex: 200,
              minWidth: 180,
              boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
            }}>
              {Object.entries(NODE_PRESETS).map(([type, preset]) => (
                <button
                  key={type}
                  onClick={() => addNode(type)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "8px 10px",
                    background: "transparent",
                    border: "none",
                    borderRadius: 6,
                    color: FGD,
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(20,184,166,0.1)"; (e.currentTarget as HTMLButtonElement).style.color = FG; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = FGD; }}
                >
                  <span>{preset.emoji}</span>
                  {type === "judgment" ? t.nodeJudgment
                  : type === "fact"    ? t.nodeFact
                  : type === "issue"   ? t.nodeIssue
                  : type === "argument"? t.nodeArgument
                  : type === "risk"    ? t.nodeRisk
                  :                     t.nodeStrategy}
                </button>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Desktop: Undo / Redo */}
        {!isMobile && (
          <>
            <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"
              style={{ ...toolbarBtn(false), opacity: canUndo ? 1 : 0.35 }}
            >{t.undo}</button>
            <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)"
              style={{ ...toolbarBtn(false), opacity: canRedo ? 1 : 0.35 }}
            >{t.redo}</button>
          </>
        )}

        {/* Desktop: Auto-layout + Group */}
        {!isMobile && nodes.length >= 2 && (
          <>
            <button
              onClick={handleAutoLayout}
              data-testid="forge-auto-layout"
              title="Auto-arrange all nodes in a hierarchy (Dagre layout)"
              style={toolbarBtn(false)}
            >⊞ Layout</button>
            <button
              onClick={handleGroupSelection}
              data-testid="forge-group-nodes"
              title="Group selected nodes into a cluster (Ctrl+G)"
              style={{
                ...toolbarBtn(false),
                opacity: nodes.filter(n => n.selected).length >= 2 ? 1 : 0.4,
              }}
            >⊕ Group</button>
          </>
        )}

        {/* Desktop: Ungroup (shown when a cluster node is selected) */}
        {!isMobile && nodes.some(n => n.selected && n.type === "cluster") && (
          <button
            onClick={() => {
              const sel = nodes.find(n => n.selected && n.type === "cluster");
              if (sel) handleExpandCluster(sel.id);
            }}
            data-testid="forge-ungroup-nodes"
            title="Ungroup the selected cluster (Ctrl+Shift+G)"
            style={toolbarBtn(false)}
          >⊖ Ungroup</button>
        )}

        {/* Save */}
        <button
          onClick={() => saveCanvas(false)}
          data-testid="forge-save"
          style={isMobile ? {
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            border: "1px solid rgba(20,184,166,0.25)",
            background: "rgba(20,184,166,0.08)",
            color: TEAL, fontSize: 15, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          } : toolbarBtn(false)}
        >
          {isMobile ? "💾" : (isSaving ? t.saving : t.save)}
        </button>

        {/* Desktop: node count badge */}
        {!isMobile && nodes.length > 0 && (
          <div style={{
            fontSize: 9.5, color: TEAL,
            background: "linear-gradient(135deg, rgba(20,184,166,0.12), rgba(14,116,144,0.08))",
            border: "1px solid rgba(20,184,166,0.2)",
            padding: "3px 10px", borderRadius: 12, fontWeight: 800,
          }}>
            {t.nodesBadge(nodes.length)}
          </div>
        )}

        {/* Desktop: language toggle */}
        {!isMobile && <LangToggle lang={lang} setLang={setLang} />}

        {/* Desktop: user avatar + logout */}
        {!isMobile && user && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginLeft: 4, flexShrink: 0 }}>
            <div style={{
              width: 27, height: 27, borderRadius: "50%",
              background: "linear-gradient(135deg, #0d9488, #14b8a6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0,
              boxShadow: "0 0 8px rgba(20,184,166,0.3)",
            }}>
              {(user.name || user.email).charAt(0).toUpperCase()}
            </div>
            <div style={{
              fontSize: 10.5, color: "#64748b", maxWidth: 80,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }} title={user.email}>
              {user.name || user.email.split("@")[0]}
            </div>
            <button
              onClick={() => void logout()}
              title="Sign out"
              style={{ ...toolbarBtn(false), fontSize: 10, padding: "4px 9px", opacity: 0.75 }}
            >
              Sign Out
            </button>
          </div>
        )}

        {/* Mobile: quick analyze */}
        {isMobile && (
          <button
            onClick={() => void runAnalysis()}
            disabled={isAnalyzing || !sessionId}
            title="Run 5 AI agents — scores propagate to connected nodes after analysis"
            style={{
              width: 34, height: 34, borderRadius: 8, flexShrink: 0,
              border: isAnalyzing ? "1px solid rgba(20,184,166,0.15)" : "1px solid rgba(168,85,247,0.35)",
              background: isAnalyzing ? "rgba(20,184,166,0.06)" : "rgba(168,85,247,0.12)",
              color: isAnalyzing ? TEAL : "#a855f7",
              fontSize: 15, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: isAnalyzing || !sessionId ? 0.5 : 1,
              transition: "all 0.15s",
            }}
          >
            {isAnalyzing ? "⏳" : "⚡"}
          </button>
        )}

        {/* Mobile: workspaces menu */}
        {isMobile && (
          <button
            onClick={() => setMobileSheet(v => v === "sessions" ? null : "sessions")}
            title="Workspaces"
            style={{
              width: 34, height: 34, borderRadius: 8, flexShrink: 0,
              border: mobileSheet === "sessions" ? "1px solid rgba(20,184,166,0.4)" : "1px solid rgba(255,255,255,0.1)",
              background: mobileSheet === "sessions" ? "rgba(20,184,166,0.12)" : "rgba(255,255,255,0.04)",
              color: mobileSheet === "sessions" ? TEAL : "#94a3b8",
              fontSize: 17, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}
          >
            ☰
          </button>
        )}
      </div>

      {/* ── Main area ── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>

        {/* Left: Agent Panel — desktop, expanded */}
        {!isMobile && !leftCollapsed && (
          <AgentPanel
            agentStates={agentStates}
            isAnalyzing={isAnalyzing}
            onAnalyze={runAnalysis}
            caseDescription={caseDescription}
            onCaseDescriptionChange={setCaseDescription}
            collabFeed={collabFeed}
            onAskAgent={onAskAgent}
            onFeedback={onFeedback}
            onDraftCopy={onDraftCopy}
            synthesisScore={synthesisScore ?? undefined}
            openAskFor={openAskForAgentId ?? undefined}
          />
        )}
        {/* Left: collapsed strip — desktop only */}
        {!isMobile && leftCollapsed && (
          <div style={{
            width: 36, flexShrink: 0,
            display: "flex", flexDirection: "column", alignItems: "center",
            paddingTop: 12, gap: 10,
            background: "rgba(8,16,36,0.97)",
            borderRight: "1px solid rgba(20,184,166,0.1)",
          }}>
            <button
              onClick={() => setLeftCollapsed(false)}
              title="Expand agent panel"
              style={{
                width: 26, height: 26, borderRadius: 7,
                border: "1px solid rgba(20,184,166,0.25)",
                background: "rgba(20,184,166,0.08)",
                color: TEAL, fontSize: 11, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >▶</button>
            <div style={{
              fontSize: 8, color: "#475569",
              writingMode: "vertical-rl", transform: "rotate(180deg)",
              letterSpacing: "0.08em", fontWeight: 700, textTransform: "uppercase",
            }}>Agents</div>
          </div>
        )}

        {/* Center: Canvas */}
        <div style={{ flex: 1, position: "relative", minWidth: 0, overflow: "hidden" }}>
          <ForgeCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnectTyped={onConnectTyped}
            onEdgeTypeChange={onEdgeTypeChange}
            onUndo={undo}
            onRedo={redo}
            onDeleteSelected={deleteSelectedNodes}
            canUndo={canUndo}
            canRedo={canRedo}
            fitViewTrigger={fitViewTrigger}
          />
          {/* Connection hints tray — slides from bottom edge */}
          {connectionHints.length > 0 && hintNewNodeId && (
            <ConnectionHintsTray
              hints={connectionHints}
              onAccept={(hint) => {
                const rel = RELATIONSHIP_TYPES[hint.relType];
                const newEdge: Edge = {
                  id: `hint-${hint.sourceId}-${hintNewNodeId}-${Date.now()}`,
                  source:  hint.sourceId,
                  target:  hintNewNodeId,
                  type:   "labeled",
                  data:   { relType: hint.relType, label: rel.label, color: rel.color },
                  style:  { stroke: rel.color, strokeWidth: 1.5 },
                  animated: true,
                };
                pushHistory([...nodes], [...edges]);
                setEdges(eds => [...eds, newEdge]);
                const remaining = connectionHints.filter(h => h.sourceId !== hint.sourceId);
                setConnectionHints(remaining);
                if (remaining.length === 0) setHintNewNodeId(null);
              }}
              onDismissHint={(sourceId) => {
                const remaining = connectionHints.filter(h => h.sourceId !== sourceId);
                setConnectionHints(remaining);
                if (remaining.length === 0) setHintNewNodeId(null);
              }}
              onDismissAll={() => { setConnectionHints([]); setHintNewNodeId(null); }}
            />
          )}
          {/* Welcome overlays */}
          {!sessionId && (
            <NoSessionWelcome
              t={t}
              onCreate={() => void createSession()}
              onCreateDemo={() => void createDemoSession()}
            />
          )}
          {sessionId && nodes.length === 0 && (
            <EmptyCanvasGuide
              t={t}
              onSearch={() => { if (isMobile) setMobileSheet("search"); else setRightPanelTab("search"); }}
              onAnalyze={() => void runAnalysis()}
              onAddNode={() => { if (isMobile) setMobileSheet("agent"); else setShowAddMenu(true); }}
              isAnalyzing={isAnalyzing}
            />
          )}
          {/* First-visit guided tour */}
          <AnimatePresence>
            {showTour && (
              <ForgeTour onDismiss={() => setShowTour(false)} />
            )}
          </AnimatePresence>
          {/* Mobile: floating "Agents" pill FAB */}
          {isMobile && sessionId && nodes.length > 0 && (
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => setMobileSheet(v => v === "agent" ? null : "agent")}
              style={{
                position: "absolute", bottom: 12, left: 12, zIndex: 20,
                height: 38, borderRadius: 19, padding: "0 16px",
                border: mobileSheet === "agent" ? "1px solid rgba(20,184,166,0.5)" : "1px solid rgba(168,85,247,0.4)",
                background: mobileSheet === "agent" ? "rgba(20,184,166,0.18)" : "rgba(8,14,32,0.88)",
                color: mobileSheet === "agent" ? TEAL : "#a855f7",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                backdropFilter: "blur(8px)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              }}
            >
              🤖 {mobileSheet === "agent" ? "Close" : "Agents"}
            </motion.button>
          )}
        </div>

        {/* Right: Sessions + Search + Simulation — desktop only */}
        <div style={{
          width: 292,
          flexShrink: 0,
          display: isMobile ? "none" : "flex",
          flexDirection: "column",
          background: PANEL,
          borderLeft: `1px solid ${BORDER}`,
          overflow: "hidden",
        }}>
          {/* Tabs */}
          <div style={{
            display: "flex",
            borderBottom: `1px solid ${BORDER}`,
            flexShrink: 0,
          }}>
            {(["sessions", "search", "insights", "simulate", "twin"] as const).map(tab => {
              const label =
                tab === "sessions" ? t.tabFiles :
                tab === "search"   ? t.tabSearch :
                tab === "insights" ? t.tabIntel  :
                tab === "twin"     ? t.tabTwin   : t.tabSim;
              const active = rightPanelTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setRightPanelTab(tab)}
                  style={{
                    flex: 1, padding: "10px 0",
                    fontSize: 9, fontWeight: 800,
                    letterSpacing: "0.02em",
                    background: active ? "rgba(20,184,166,0.08)" : "transparent",
                    border: "none",
                    borderBottom: active ? `2px solid ${TEAL}` : "2px solid transparent",
                    color: active ? TEAL : FGD,
                    cursor: "pointer", transition: "all 0.15s",
                    lineHeight: 1.2,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Sessions tab */}
          {rightPanelTab === "sessions" && (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              {/* Search + new workspace */}
              <div style={{ padding: "10px 12px 0", display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => createSession()}
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "linear-gradient(135deg, rgba(20,184,166,0.12), rgba(14,116,144,0.08))",
                  border: `1px solid rgba(20,184,166,0.25)`,
                  borderRadius: 9,
                  color: TEAL,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                  letterSpacing: "0.01em",
                }}
              >
                {t.newWorkspace}
              </motion.button>

              {/* Search input */}
              {sessions.length > 2 && (
                <input
                  value={sessionSearch}
                  onChange={e => setSessionSearch(e.target.value)}
                  placeholder="Search workspaces…"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "7px 10px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 7,
                    color: FG, fontSize: 10.5,
                    outline: "none",
                  }}
                />
              )}
            </div>

            {/* Scrollable sessions list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>

              {/* Skeleton while loading */}
              {isLoadingSessions && Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{
                  padding: "12px",
                  borderRadius: 9,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.04)",
                  animation: "forge-pulse 1.6s ease-in-out infinite",
                  animationDelay: `${i * 0.18}s`,
                }}>
                  <div style={{ height: 10, borderRadius: 4, background: "rgba(255,255,255,0.07)", marginBottom: 8, width: `${70 + i * 10}%` }} />
                  <div style={{ height: 8,  borderRadius: 4, background: "rgba(255,255,255,0.04)", width: "45%" }} />
                </div>
              ))}

              {/* Empty state */}
              {!isLoadingSessions && sessions.filter(s =>
                !sessionSearch.trim() ||
                s.title.toLowerCase().includes(sessionSearch.toLowerCase()) ||
                (s.case_description ?? "").toLowerCase().includes(sessionSearch.toLowerCase())
              ).length === 0 && (
                <div style={{ textAlign: "center", padding: "28px 12px", color: "#64748b", fontSize: 10.5, lineHeight: 1.7 }}>
                  <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.4 }}>
                    {sessionSearch.trim() ? "🔍" : "🗂️"}
                  </div>
                  {sessionSearch.trim() ? "No matching workspaces" : t.noSessions}
                </div>
              )}

              {/* Session cards */}
              {!isLoadingSessions && sessions
                .filter(s =>
                  !sessionSearch.trim() ||
                  s.title.toLowerCase().includes(sessionSearch.toLowerCase()) ||
                  (s.case_description ?? "").toLowerCase().includes(sessionSearch.toLowerCase())
                )
                .map(s => {
                  const active = s.id === sessionId;
                  const nodeCount = Array.isArray(s.nodes_json) ? s.nodes_json.length : 0;
                  const updated = new Date(s.updated_at);
                  const diffH = (Date.now() - updated.getTime()) / 36e5;
                  const timeLabel = diffH < 1 ? "Just now"
                    : diffH < 24 ? `${Math.round(diffH)}h ago`
                    : updated.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

                  return (
                    <motion.div
                      key={s.id}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => openSession(s)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 9,
                        background: active
                          ? "linear-gradient(135deg, rgba(20,184,166,0.1), rgba(14,116,144,0.06))"
                          : "rgba(255,255,255,0.02)",
                        border: `1px solid ${active ? "rgba(20,184,166,0.3)" : "rgba(255,255,255,0.05)"}`,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        boxShadow: active ? "0 2px 12px rgba(20,184,166,0.08)" : "none",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 4 }}>
                        <div style={{
                          fontWeight: 700, fontSize: 11,
                          color: active ? TEAL : FG,
                          flex: 1, minWidth: 0,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {active && <span style={{ marginRight: 5, fontSize: 8, color: TEAL }}>●</span>}
                          {s.title}
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); deleteSession(s.id); }}
                          style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 10, padding: "0 0 0 4px", flexShrink: 0, lineHeight: 1 }}
                        >✕</button>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 5 }}>
                        <div style={{ fontSize: 9, color: "#64748b" }}>{timeLabel}</div>
                        {nodeCount > 0 && (
                          <div style={{
                            fontSize: 8.5, color: active ? TEAL : "#475569",
                            background: active ? "rgba(20,184,166,0.1)" : "rgba(255,255,255,0.04)",
                            padding: "2px 7px", borderRadius: 8, fontWeight: 700,
                          }}>
                            {t.nodesBadge(nodeCount)}
                          </div>
                        )}
                      </div>

                      {s.case_description && (
                        <div style={{
                          fontSize: 9.5, color: "#64748b", marginTop: 5,
                          lineHeight: 1.5, overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        } as React.CSSProperties}>
                          {s.case_description}
                        </div>
                      )}
                    </motion.div>
                  );
                })
              }
            </div>
          </div>
          )}

          {/* Search tab — scrollable */}
          {rightPanelTab === "search" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <SearchPanel
                sessionId={sessionId}
                nodes={nodes}
                caseDescription={caseDescription}
                onNodesAdded={onSearchNodesAdded}
              />
            </div>
          )}

          {/* Proactive Intelligence tab — scrollable */}
          {rightPanelTab === "insights" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <ProactivePanel
                suggestions={suggestions}
                isLoading={isLoadingInsights}
                canvasHasNodes={nodes.length >= 2}
                sessionReady={!!sessionId}
                onRefresh={fetchInsights}
                onAccept={onAcceptSuggestion}
                onDismiss={onDismissSuggestion}
              />
            </div>
          )}

          {/* Personal Legal Twin tab — scrollable */}
          {rightPanelTab === "twin" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <PersonalTwinPanel
                profile={twinProfile}
                crossMatter={crossMatter}
                isLoading={isLoadingTwin}
                sessionReady={!!sessionId}
                onToggleLearning={onToggleLearning}
                onReset={onResetProfile}
                onRefresh={fetchTwinData}
                onOpenSession={(sid) => openSession({ id: sid, title: "", case_description: "", nodes_json: [], edges_json: [], insights: [], updated_at: "" })}
                onReactivateSuggestionType={onReactivateSuggestionType}
              />
            </div>
          )}

          {/* What-If Simulation tab — scrollable */}
          {rightPanelTab === "simulate" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <SimulationPanel
                nodes={nodes}
                simState={simState}
                simHistory={simHistory}
                onRunSimulation={runSimulation}
                onSaveSimulation={onSaveSimulation}
                onApplyToCanvas={onApplyToCanvas}
              />
            </div>
          )}

          {/* Canvas stats footer — always pinned to bottom, never scrolled away */}
          <div style={{
            padding: "10px 14px",
            borderTop: `1px solid ${BORDER}`,
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", gap: 12 }}>
              {[
                { label: t.statNodes,  value: nodes.length },
                { label: t.statEdges,  value: edges.length },
                { label: t.statAgents, value: `${Object.values(agentStates).filter(s => s.status === "done").length}/5` },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: TEAL }}>{value}</div>
                  <div style={{ fontSize: 8.5, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* ── Mobile: fixed bottom tab bar ── */}
    {isMobile && (
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, height: 56,
        background: "rgba(6,12,28,0.97)",
        borderTop: "1px solid rgba(20,184,166,0.15)",
        display: "flex", zIndex: 110,
        backdropFilter: "blur(12px)",
      }}>
        {([
          { id: "agent" as const,    emoji: "🤖", label: "Agents"  },
          { id: "sessions" as const, emoji: "📁", label: "Files"   },
          { id: "search" as const,   emoji: "🔍", label: "Search"  },
          { id: "insights" as const, emoji: "✦",  label: "Intel"   },
          { id: "simulate" as const, emoji: "⚡",  label: "Sim"     },
          { id: "twin" as const,     emoji: "🧬", label: "Twin"    },
        ]).map(tab => {
          const active = mobileSheet === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setMobileSheet(v => v === tab.id ? null : tab.id)}
              style={{
                flex: 1, border: "none",
                background: active ? "rgba(20,184,166,0.1)" : "transparent",
                borderTop: active ? "2px solid #14b8a6" : "2px solid transparent",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 2,
                cursor: "pointer", transition: "all 0.15s", padding: "4px 0",
              }}
            >
              <span style={{ fontSize: 16 }}>{tab.emoji}</span>
              <span style={{ fontSize: 8, fontWeight: 700, color: active ? "#14b8a6" : "#64748b", letterSpacing: "0.04em" }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    )}

    {/* ── Mobile: slide-up sheet ── */}
    <AnimatePresence>
      {isMobile && mobileSheet && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileSheet(null)}
            style={{
              position: "fixed", inset: 0, zIndex: 105,
              background: "rgba(0,0,0,0.5)",
            }}
          />
          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 350 }}
            style={{
              position: "fixed", bottom: 56, left: 0, right: 0,
              height: "65vh",
              background: "rgba(7,13,28,0.99)",
              border: "1px solid rgba(20,184,166,0.18)",
              borderRadius: "16px 16px 0 0",
              zIndex: 106,
              display: "flex", flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.6)",
            }}
          >
            {/* Sheet header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 16px 8px",
              borderBottom: "1px solid rgba(20,184,166,0.1)",
              flexShrink: 0,
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#14b8a6", letterSpacing: "0.04em" }}>
                {mobileSheet === "agent"    ? "🤖 AI Agents"
                : mobileSheet === "sessions" ? "📁 Workspaces"
                : mobileSheet === "search"   ? "🔍 Case Law Search"
                : mobileSheet === "insights" ? "✦ Proactive Intel"
                : mobileSheet === "simulate" ? "⚡ What-If Simulation"
                :                              "🧬 Personal Legal Twin"}
              </div>
              <button
                onClick={() => setMobileSheet(null)}
                style={{ background: "none", border: "none", color: "#64748b", fontSize: 16, cursor: "pointer", padding: "0 4px" }}
              >✕</button>
            </div>

            {/* Sheet content */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {mobileSheet === "agent" && (
                <AgentPanel
                  agentStates={agentStates}
                  isAnalyzing={isAnalyzing}
                  onAnalyze={runAnalysis}
                  caseDescription={caseDescription}
                  onCaseDescriptionChange={setCaseDescription}
                  collabFeed={collabFeed}
                  onAskAgent={onAskAgent}
                  onFeedback={onFeedback}
                  onDraftCopy={onDraftCopy}
                  synthesisScore={synthesisScore ?? undefined}
                  openAskFor={openAskForAgentId ?? undefined}
                />
              )}
              {mobileSheet === "sessions" && (
                <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { void createSession(); setMobileSheet(null); }}
                    style={{
                      width: "100%", padding: "11px",
                      background: "linear-gradient(135deg, rgba(20,184,166,0.12), rgba(14,116,144,0.08))",
                      border: "1px solid rgba(20,184,166,0.25)",
                      borderRadius: 9, color: "#14b8a6", fontSize: 12, fontWeight: 800, cursor: "pointer",
                    }}
                  >
                    {t.newWorkspace}
                  </motion.button>
                  {sessions.map(s => {
                    const active = s.id === sessionId;
                    const nodeCount = Array.isArray(s.nodes_json) ? s.nodes_json.length : 0;
                    return (
                      <motion.div
                        key={s.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { void openSession(s); setMobileSheet(null); }}
                        style={{
                          padding: "11px 13px", borderRadius: 9,
                          background: active ? "linear-gradient(135deg, rgba(20,184,166,0.1), rgba(14,116,144,0.06))" : "rgba(255,255,255,0.02)",
                          border: active ? "1px solid rgba(20,184,166,0.3)" : "1px solid rgba(255,255,255,0.06)",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 12, color: active ? "#14b8a6" : "#e2e8f0", marginBottom: 4 }}>
                          {active && <span style={{ marginRight: 5, fontSize: 9 }}>●</span>}
                          {s.title}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontSize: 9.5, color: "#64748b" }}>
                            {new Date(s.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </div>
                          {nodeCount > 0 && (
                            <div style={{ fontSize: 9, color: active ? "#14b8a6" : "#475569", fontWeight: 700 }}>
                              {t.nodesBadge(nodeCount)}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
              {mobileSheet === "search" && (
                <SearchPanel
                  sessionId={sessionId}
                  nodes={nodes}
                  caseDescription={caseDescription}
                  onNodesAdded={onSearchNodesAdded}
                />
              )}
              {mobileSheet === "insights" && (
                <ProactivePanel
                  suggestions={suggestions}
                  isLoading={isLoadingInsights}
                  canvasHasNodes={nodes.length >= 2}
                  sessionReady={!!sessionId}
                  onRefresh={fetchInsights}
                  onAccept={onAcceptSuggestion}
                  onDismiss={onDismissSuggestion}
                />
              )}
              {mobileSheet === "simulate" && (
                <SimulationPanel
                  nodes={nodes}
                  simState={simState}
                  simHistory={simHistory}
                  onRunSimulation={runSimulation}
                  onSaveSimulation={onSaveSimulation}
                  onApplyToCanvas={onApplyToCanvas}
                />
              )}
              {mobileSheet === "twin" && (
                <PersonalTwinPanel
                  profile={twinProfile}
                  crossMatter={crossMatter}
                  isLoading={isLoadingTwin}
                  sessionReady={!!sessionId}
                  onToggleLearning={onToggleLearning}
                  onReset={onResetProfile}
                  onRefresh={fetchTwinData}
                  onOpenSession={(sid) => openSession({ id: sid, title: "", case_description: "", nodes_json: [], edges_json: [], insights: [], updated_at: "" })}
                  onReactivateSuggestionType={onReactivateSuggestionType}
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

    {/* Toast notifications */}
    <ToastStack toasts={toasts} onDismiss={dismissToast} />

    {/* Keyframes for skeleton pulse */}
    <style>{`@keyframes forge-pulse { 0%,100% { opacity:.65 } 50% { opacity:.25 } }`}</style>
    </>
  );
}

// ─── Shared button style ───────────────────────────────────────────────────────

function toolbarBtn(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 7,
    border: `1px solid ${active ? "rgba(20,184,166,0.4)" : "rgba(255,255,255,0.08)"}`,
    background: active ? "rgba(20,184,166,0.12)" : "rgba(255,255,255,0.04)",
    color: active ? "#14b8a6" : "#94a3b8",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.15s",
    whiteSpace: "nowrap",
  };
}
