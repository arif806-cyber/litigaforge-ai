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
import SimulationPanel, { type SimState, type SimulationResult, type NodeDelta } from "@/components/workspace/SimulationPanel";
import SearchPanel from "@/components/workspace/SearchPanel";

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
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res;
}

// ─── Node presets for manual "Add Node" ───────────────────────────────────────

const NODE_PRESETS: Record<string, { type: string; label: string; emoji: string; data: Record<string, unknown> }> = {
  judgment: { type: "judgment", label: "New Judgment",  emoji: "⚖️", data: { label: "New Judgment",   court: "Court",  summary: "",  impact_score: 75, citation: "" } },
  fact:     { type: "fact",     label: "New Fact",      emoji: "📋", data: { label: "New Fact",        content: "",     impact_score: 70 } },
  issue:    { type: "issue",    label: "Legal Issue",   emoji: "🏛️", data: { label: "Legal Issue",     description: "", impact_score: 80 } },
  argument: { type: "argument", label: "Argument",      emoji: "🗣️", data: { label: "New Argument",    content: "",     strength: 75, impact_score: 75 } },
  risk:     { type: "risk",     label: "Risk Factor",   emoji: "⚠️", data: { label: "Risk Factor",     description: "", severity: 5,  impact_score: 50 } },
  strategy: { type: "strategy", label: "Strategy",      emoji: "💡", data: { label: "New Strategy",    description: "", confidence: 75, impact_score: 75 } },
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
  const [error, setError]                   = useState("");
  const [showAddMenu, setShowAddMenu]       = useState(false);
  const [showSessions, setShowSessions]     = useState(false);
  const [rightPanelTab, setRightPanelTab]   = useState<"sessions" | "search" | "simulate" | "insights">("sessions");
  const [simState, setSimState]             = useState<SimState>({ phase: "idle", scenario: "", before: null, after: null, deltas: [], analysis: "", agents: [] });
  const [simHistory, setSimHistory]         = useState<SimulationResult[]>([]);
  const [suggestions, setSuggestions]       = useState<Suggestion[]>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [collabFeed, setCollabFeed]         = useState<CollabEvent[]>([]);
  const [synthesisScore, setSynthesisScore] = useState<number | null>(null);

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
    try {
      const res  = await api("/workspace/sessions");
      const list = await res.json() as WorkspaceSession[];
      setSessions(list);
      if (list.length > 0) {
        await openSession(list[0]);
      } else {
        await createSession("My First Workspace");
      }
    } catch (e) {
      setError("Failed to load workspaces.");
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
    } catch {
      setError("Failed to open workspace.");
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
      if (!silent) setError("Save failed.");
    } finally {
      if (!silent) setIsSaving(false);
    }
  }

  async function saveTitle() {
    if (!sessionId) return;
    await api(`/workspace/sessions/${sessionId}`, {
      method: "PUT",
      body: JSON.stringify({ title: sessionTitle, case_description: caseDescription }),
    }).catch(() => {});
  }

  async function deleteSession(id: number) {
    await api(`/workspace/sessions/${id}`, { method: "DELETE" }).catch(() => {});
    const remaining = sessions.filter(s => s.id !== id);
    setSessions(remaining);
    if (id === sessionId) {
      if (remaining.length > 0) {
        openSession(remaining[0]);
      } else {
        createSession();
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
      position: { x: 200 + Math.random() * 300, y: 200 + Math.random() * 200 },
      data: { ...preset.data },
    };
    pushHistory([...nodes], [...edges]);
    setNodes(prev => [...prev, newNode]);
    setShowAddMenu(false);
  }

  // ─── Search panel callback ────────────────────────────────────────────────────

  const onSearchNodesAdded = useCallback((newNodes: Node[]) => {
    if (!newNodes.length) return;
    pushHistory([...nodes], [...edges]);
    setNodes(prev => {
      const existingIds = new Set(prev.map(n => n.id));
      const deduped = newNodes
        .filter(n => !existingIds.has(n.id))
        .map((n, i) => ({
          ...n,
          position: {
            x: 150 + (i % 3) * 260 + Math.round(Math.random() * 40),
            y: 140 + Math.floor(i / 3) * 200 + Math.round(Math.random() * 30),
          },
        }));
      return [...prev, ...deduped];
    });
    // Insights refresh happens naturally when user opens the Insights tab next time
  }, [nodes, edges, setNodes]);

  // ─── Multi-agent analysis (SSE) ──────────────────────────────────────────────

  const runAnalysis = useCallback(async () => {
    if (!sessionId || isAnalyzing) return;
    setIsAnalyzing(true);
    setAgentStates(makeDefaultAgentStates());
    setCollabFeed([]);
    setSynthesisScore(null);

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
                  const placed = { ...sn, position: { x: 200 + Math.random() * 500, y: 150 + Math.random() * 350 } };
                  return [...prev, placed as Node];
                });
              }
            } else if (type === "agent_consult") {
              setCollabFeed(prev => [...prev, {
                from:      event.from as string,
                to:        event.to as string,
                message:   event.message as string,
                timestamp: Date.now(),
              }]);
            } else if (type === "agent_synthesis") {
              setSynthesisScore(event.consensus_score as number);
            }
          } catch { /* malformed event */ }
        }
      }
    } catch (err) {
      setError("Analysis stream failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
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
      position: { x: 200 + Math.random() * 400, y: 180 + Math.random() * 300 },
      data:     { ...preset.data, label: s.text.slice(0, 50), description: s.detail ?? s.text, impact_score: 75 },
    } as Node]);
    setSuggestions(prev => prev.filter(x => x.id !== s.id));
  }, [nodes, edges, setNodes]);

  const onDismissSuggestion = useCallback((id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
  }, []);

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
  }, []);

  // ─── Auto-fetch insights when switching to insights tab ───────────────────────

  useEffect(() => {
    if (rightPanelTab === "insights" && sessionId && suggestions.length === 0 && !isLoadingInsights) {
      void fetchInsights();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rightPanelTab, sessionId]);

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
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginRight: 8 }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 12, color: TEAL, letterSpacing: "0.03em" }}>
              FORGE
            </div>
            <div style={{ fontSize: 8.5, color: FGD, letterSpacing: "0.05em", marginTop: -1 }}>
              WORKSPACE
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
            + Add Node ▾
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
                  {preset.label}
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
          ↩ Undo
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          style={{ ...toolbarBtn(false), opacity: canRedo ? 1 : 0.35 }}
        >
          ↪ Redo
        </button>

        {/* Save */}
        <button
          onClick={() => saveCanvas(false)}
          data-testid="forge-save"
          style={toolbarBtn(false)}
        >
          {isSaving ? "Saving…" : "💾 Save"}
        </button>

        {/* Node count badge */}
        {nodes.length > 0 && (
          <div style={{
            fontSize: 10, color: TEAL, background: "rgba(20,184,166,0.12)",
            padding: "3px 8px", borderRadius: 12, fontWeight: 700,
          }}>
            {nodes.length} nodes
          </div>
        )}

        {error && (
          <div style={{ fontSize: 10, color: "#ef4444", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            ⚠ {error}
          </div>
        )}
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

        {/* Right: Sessions + Search + Simulation */}
        <div style={{
          width: 292,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          background: PANEL,
          borderLeft: `1px solid ${BORDER}`,
          overflowY: "auto",
        }}>
          {/* Tabs */}
          <div style={{
            display: "flex",
            borderBottom: `1px solid ${BORDER}`,
            flexShrink: 0,
          }}>
            {(["sessions", "search", "insights", "simulate"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setRightPanelTab(tab)}
                style={{
                  flex: 1, padding: "9px 0",
                  fontSize: 8.5, fontWeight: 700,
                  textTransform: "uppercase" as const, letterSpacing: "0.05em",
                  background: "transparent", border: "none",
                  borderBottom: rightPanelTab === tab ? `2px solid ${TEAL}` : "2px solid transparent",
                  color: rightPanelTab === tab ? TEAL : FGD,
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {tab === "sessions" ? "📁 Files"
                  : tab === "search" ? "🔍 Search"
                  : tab === "insights" ? "✦ Intel"
                  : "⚡ Sim"}
              </button>
            ))}
          </div>

          {/* Sessions tab */}
          {rightPanelTab === "sessions" && (
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={() => createSession()}
                style={{
                  width: "100%",
                  padding: "9px",
                  background: "rgba(20,184,166,0.1)",
                  border: `1px solid rgba(20,184,166,0.2)`,
                  borderRadius: 8,
                  color: TEAL,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                + New Workspace
              </button>
              {sessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => openSession(s)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: s.id === sessionId ? "rgba(20,184,166,0.08)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${s.id === sessionId ? "rgba(20,184,166,0.25)" : "rgba(255,255,255,0.05)"}`,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ fontWeight: 700, fontSize: 11.5, color: s.id === sessionId ? TEAL : FG, flex: 1, minWidth: 0 }}>
                      {s.title}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); deleteSession(s.id); }}
                      style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 11, padding: "0 0 0 4px", flexShrink: 0 }}
                    >✕</button>
                  </div>
                  <div style={{ fontSize: 9.5, color: "#475569", marginTop: 3 }}>
                    {new Date(s.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Search tab */}
          {rightPanelTab === "search" && (
            <SearchPanel
              sessionId={sessionId}
              nodes={nodes}
              caseDescription={caseDescription}
              onNodesAdded={onSearchNodesAdded}
            />
          )}

          {/* Proactive Intelligence tab */}
          {rightPanelTab === "insights" && (
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

          {/* What-If Simulation tab */}
          {rightPanelTab === "simulate" && (
            <SimulationPanel
              nodes={nodes}
              simState={simState}
              simHistory={simHistory}
              onRunSimulation={runSimulation}
              onSaveSimulation={onSaveSimulation}
              onApplyToCanvas={onApplyToCanvas}
            />
          )}

          {/* Canvas stats footer */}
          <div style={{
            marginTop: "auto",
            padding: "10px 14px",
            borderTop: `1px solid ${BORDER}`,
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", gap: 12 }}>
              {[
                { label: "Nodes", value: nodes.length },
                { label: "Edges", value: edges.length },
                { label: "Agents", value: Object.values(agentStates).filter(s => s.status === "done").length + "/5" },
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
