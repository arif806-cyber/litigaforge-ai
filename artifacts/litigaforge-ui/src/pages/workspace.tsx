import { useState, useCallback, useEffect, useRef } from "react";
import {
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import { motion } from "framer-motion";
import ForgeCanvas from "@/components/workspace/ForgeCanvas";
import AgentPanel, { type AgentState, type CollabEvent } from "@/components/workspace/AgentPanel";
import { RELATIONSHIP_TYPES, type RelType } from "@/components/workspace/EdgeTypes";
import ProactivePanel, { type Suggestion } from "@/components/workspace/ProactivePanel";
import PersonalTwinPanel, { type TwinProfile, type CrossMatterData } from "@/components/workspace/PersonalTwinPanel";
import SimulationPanel, { type SimState, type SimulationResult, type NodeDelta } from "@/components/workspace/SimulationPanel";
import SearchPanel from "@/components/workspace/SearchPanel";
import { LangToggle, STRINGS, getInitialLang, type Lang } from "@/components/workspace/WorkspaceLang";
import { NoSessionWelcome, EmptyCanvasGuide } from "@/components/workspace/ForgeWelcome";
import { ToastStack, type ForgeToastItem } from "@/components/workspace/ForgeToast";

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

function makeDefaultAgentStates(): Record<string, AgentState> {
  return Object.fromEntries(AGENT_IDS.map(id => [id, { status: "idle" as const, text: "" }]));
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
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [collabFeed, setCollabFeed]         = useState<CollabEvent[]>([]);
  const [synthesisScore, setSynthesisScore] = useState<number | null>(null);
  const [twinProfile, setTwinProfile]       = useState<TwinProfile | null>(null);
  const [crossMatter, setCrossMatter]       = useState<CrossMatterData | null>(null);
  const [isLoadingTwin, setIsLoadingTwin]   = useState(false);
  const [lang, setLang]                     = useState<Lang>(getInitialLang);
  const [toasts, setToasts]                 = useState<ForgeToastItem[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sessionSearch, setSessionSearch]   = useState("");
  const t = STRINGS[lang];

  function addToast(item: Omit<ForgeToastItem, "id">) {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev.slice(-5), { ...item, id }]);
  }
  function dismissToast(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  const saveTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addMenuRef     = useRef<HTMLDivElement>(null);
  const historyRef     = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const histIdxRef     = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // ─── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    setIsLoadingSessions(true);
    try {
      const res  = await api("/workspace/sessions");
      const list = await res.json() as WorkspaceSession[];
      setSessions(list);
      if (list.length > 0) {
        await openSession(list[0]);
      } else {
        await createSession("My First Workspace");
      }
    } catch {
      addToast({ type: "error", message: "Failed to load workspaces", detail: "Check your connection and refresh." });
    } finally {
      setIsLoadingSessions(false);
    }
  }

  async function createSession(title = "Untitled Workspace") {
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
    setNodes(ns => {
      const updated = ns.map(n => ({ ...n, data: { ...(n.data as Record<string, unknown>) } }));
      const idxMap  = new Map(updated.map((n, i) => [n.id, i]));
      for (const e of currentEdges) {
        const si = idxMap.get(e.source);
        const ti = idxMap.get(e.target);
        if (si === undefined || ti === undefined) continue;
        const srcScore = Number((updated[si].data as Record<string, unknown>).impact_score ?? 70);
        const d = updated[ti].data as Record<string, unknown>;
        const tgtScore = Number(d.impact_score ?? 70);
        const rel = ((e.data as Record<string, unknown>)?.relType as string) ?? "";
        let delta = 0;
        if (rel === "supports")     delta =  Math.round(srcScore * 0.08);
        else if (rel === "cites")   delta =  5;
        else if (rel === "contradicts") delta = -10;
        if (delta !== 0) {
          updated[ti] = { ...updated[ti], data: { ...d, impact_score: Math.min(100, Math.max(5, tgtScore + delta)) } };
        }
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
    // Fire judgment_add learning events for each added judgment node
    if (sessionId) {
      newNodes.filter(n => n.type === "judgment").forEach(n => {
        const d = n.data as Record<string, unknown>;
        void api("/workspace/profile/event", {
          method: "POST",
          body: JSON.stringify({
            event_type: "judgment_add",
            session_id: sessionId,
            data: { court: d.court ?? "", title: (d.label ?? "").toString().slice(0, 80) },
          }),
        }).catch(() => {});
      });
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
            } else if (type === "agent_synthesis") {
              const score = event.consensus_score as number;
              setSynthesisScore(score);
              localSynthesisScore = score;
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
              setSimState(p => ({ ...p, deltas: ev.deltas as NodeDelta[] }));
            } else if (etype === "sim_after") {
              setSimState(p => ({
                ...p,
                after: {
                  avgScore:        ev.avg_score      as number,
                  riskLevel:       ev.risk_level     as string,
                  scoreChange:     ev.score_change   as number,
                  summary:         ev.summary        as string,
                  recommendation:  ev.recommendation as string,
                },
              }));
            } else if (etype === "sim_complete") {
              setSimState(p => ({ ...p, phase: "complete" }));
            }
          } catch { /* malformed */ }
        }
      }
    } catch {
      setSimState(p => ({ ...p, phase: "complete" }));
    }
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

  const fetchInsights = useCallback(async () => {
    if (!sessionId || isLoadingInsights) return;
    setIsLoadingInsights(true);
    try {
      const res = await api(`/workspace/sessions/${sessionId}/insights`, {
        method: "POST",
        body: JSON.stringify({ case_description: caseDescription, nodes }),
      });
      const data = await res.json() as { suggestions: Suggestion[] };
      setSuggestions(data.suggestions ?? []);
    } catch { /* keep existing */ } finally {
      setIsLoadingInsights(false);
    }
  }, [sessionId, caseDescription, nodes, isLoadingInsights]);

  const onAcceptSuggestion = useCallback((s: Suggestion) => {
    const typeMap: Record<string, string> = { opportunity: "strategy", risk: "risk", precedent: "judgment", pattern: "argument", warning: "fact" };
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
  }, [nodes, edges, setNodes, sessionId]);

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

  const onFeedback = useCallback((agentId: string, vote: "up" | "down") => {
    setAgentStates(prev => ({
      ...prev,
      [agentId]: {
        ...(prev[agentId] ?? { status: "done", text: "" }),
        feedback: prev[agentId]?.feedback === vote ? null : vote,
      },
    }));
    // Persist feedback to backend for twin learning
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

  // ─── Auto-fetch insights when switching to insights tab ───────────────────────

  useEffect(() => {
    if (rightPanelTab === "insights" && sessionId && suggestions.length === 0 && !isLoadingInsights) {
      void fetchInsights();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rightPanelTab, sessionId]);

  // ─── Personal Legal Twin — fetch profile + cross-matter ───────────────────────

  const fetchTwinData = useCallback(async () => {
    if (!sessionId || isLoadingTwin) return;
    setIsLoadingTwin(true);
    try {
      const [profRes, crossRes] = await Promise.all([
        api("/workspace/profile"),
        api(`/workspace/sessions/${sessionId}/cross-matter`),
      ]);
      setTwinProfile(await profRes.json() as TwinProfile);
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
        gap: 8,
        padding: "0 14px",
        height: 52,
        flexShrink: 0,
        background: PANEL,
        borderBottom: `1px solid ${BORDER}`,
        zIndex: 10,
      }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 6 }}>
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
            fontSize: 12,
            color: FG,
            fontWeight: 600,
            outline: "none",
            width: 200,
          }}
        />

        <div style={{ flex: 1 }} />

        {/* Add node */}
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

        {/* Undo / Redo */}
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{ ...toolbarBtn(false), opacity: canUndo ? 1 : 0.35 }}
        >
          {t.undo}
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          style={{ ...toolbarBtn(false), opacity: canRedo ? 1 : 0.35 }}
        >
          {t.redo}
        </button>

        {/* Save */}
        <button
          onClick={() => saveCanvas(false)}
          data-testid="forge-save"
          style={toolbarBtn(false)}
        >
          {isSaving ? t.saving : t.save}
        </button>

        {/* Node count badge */}
        {nodes.length > 0 && (
          <div style={{
            fontSize: 9.5, color: TEAL,
            background: "linear-gradient(135deg, rgba(20,184,166,0.12), rgba(14,116,144,0.08))",
            border: "1px solid rgba(20,184,166,0.2)",
            padding: "3px 10px", borderRadius: 12, fontWeight: 800,
          }}>
            {t.nodesBadge(nodes.length)}
          </div>
        )}

        {/* Language toggle */}
        <LangToggle lang={lang} setLang={setLang} />
      </div>

      {/* ── Main area ── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>

        {/* Left: Agent Panel */}
        <AgentPanel
          agentStates={agentStates}
          isAnalyzing={isAnalyzing}
          onAnalyze={runAnalysis}
          caseDescription={caseDescription}
          onCaseDescriptionChange={setCaseDescription}
          collabFeed={collabFeed}
          onAskAgent={onAskAgent}
          onFeedback={onFeedback}
          synthesisScore={synthesisScore ?? undefined}
        />

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
          />
          {/* Welcome overlays */}
          {!sessionId && (
            <NoSessionWelcome t={t} onCreate={() => void createSession()} />
          )}
          {sessionId && nodes.length === 0 && (
            <EmptyCanvasGuide
              t={t}
              onSearch={() => setRightPanelTab("search")}
              onAnalyze={() => void runAnalysis()}
              onAddNode={() => setShowAddMenu(true)}
              isAnalyzing={isAnalyzing}
            />
          )}
        </div>

        {/* Right: Sessions + Search + Simulation */}
        <div style={{
          width: 292,
          flexShrink: 0,
          display: "flex",
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
