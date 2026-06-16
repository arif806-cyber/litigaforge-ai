import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Node } from "@xyflow/react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SearchResultNode extends Node {
  data: {
    label:        string;
    court:        string;
    citation:     string;
    summary:      string;
    year:         string;
    url:          string;
    impact_score: number;
    ik_tid?:      string | number;
    num_citing?:  number;
    search_query?:string;
    [key: string]: unknown;
  };
}

interface SearchPanelProps {
  sessionId:     number | null;
  nodes:         Node[];
  caseDescription: string;
  onNodesAdded:  (nodes: Node[]) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const BASE = "/litigaforge";

function getAuthHeaders(): Record<string, string> {
  const t = localStorage.getItem("lf_token") || "";
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function courtColor(court: string) {
  const c = court.toLowerCase();
  if (c.includes("supreme court")) return "#f59e0b";
  if (c.includes("high court"))    return "#3b82f6";
  if (c.includes("tribunal"))      return "#a855f7";
  return "#64748b";
}

function courtShort(court: string) {
  if (/supreme/i.test(court)) return "SC";
  const hc = court.match(/(\w+)\s+high court/i);
  if (hc) return `${hc[1].slice(0, 3).toUpperCase()} HC`;
  if (/tribunal/i.test(court)) return "TRB";
  return court.slice(0, 6);
}

// ─── Result card ───────────────────────────────────────────────────────────────

function ResultCard({
  node,
  added,
  onAdd,
}: {
  node:  SearchResultNode;
  added: boolean;
  onAdd: (n: SearchResultNode) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const d      = node.data;
  const color  = courtColor(d.court);
  const score  = d.impact_score ?? 70;
  const nCite  = d.num_citing   ?? 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, overflow: "hidden", marginBottom: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        background: added ? "rgba(20,184,166,0.06)" : "rgba(255,255,255,0.03)",
        border:     `1px solid ${added ? "rgba(20,184,166,0.25)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Court-colored top accent */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${color}66, transparent)` }} />

      <div style={{ padding: "9px 11px" }}>
        {/* Court badge + year + citations */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, flexWrap: "wrap" as const }}>
          <span style={{
            fontSize: 8, fontWeight: 800, letterSpacing: "0.05em",
            background: `${color}20`, border: `1px solid ${color}44`,
            color, padding: "2px 7px", borderRadius: 5,
          }}>
            {courtShort(d.court)}
          </span>
          {d.year && (
            <span style={{ fontSize: 8.5, color: "#64748b" }}>{d.year}</span>
          )}
          {nCite > 0 && (
            <span style={{ fontSize: 8.5, color: "#64748b" }}>
              {nCite.toLocaleString()} cites
            </span>
          )}
          {/* Impact score bar */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 36, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${score}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{
                  height: "100%",
                  background: score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444",
                  borderRadius: 2,
                }}
              />
            </div>
            <span style={{ fontSize: 8.5, color: "#64748b", fontWeight: 700 }}>{score}</span>
          </div>
        </div>

        {/* Title */}
        <div style={{
          fontSize: 10.5, fontWeight: 700, color: "#e2e8f0",
          lineHeight: 1.4, marginBottom: 5,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        } as React.CSSProperties}>
          {d.label}
        </div>

        {/* Snippet */}
        {d.summary && (
          <div
            onClick={() => setExpanded(v => !v)}
            style={{
              fontSize: 9.5, color: "#64748b", lineHeight: 1.6,
              marginBottom: 7, cursor: "pointer",
              overflow: "hidden",
              maxHeight: expanded ? "none" : "3.2em",
              display: "-webkit-box",
              WebkitLineClamp: expanded ? undefined : 2,
              WebkitBoxOrient: "vertical",
            } as React.CSSProperties}
          >
            {d.summary}
          </div>
        )}

        {/* Source query pill */}
        {d.search_query && (
          <div style={{
            display: "inline-block", fontSize: 8, color: "#475569",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
            padding: "2px 7px", borderRadius: 4, marginBottom: 7,
          }}>
            via "{d.search_query}"
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => !added && onAdd(node)}
            style={{
              flex: 1, padding: "5px 0", borderRadius: 6, cursor: added ? "default" : "pointer",
              border: `1px solid ${added ? "rgba(20,184,166,0.3)" : "rgba(255,255,255,0.1)"}`,
              background: added ? "rgba(20,184,166,0.1)" : "rgba(255,255,255,0.04)",
              color: added ? "#14b8a6" : "#94a3b8",
              fontSize: 9.5, fontWeight: 700,
              transition: "all 0.15s",
            }}
          >
            {added ? "✓ On Canvas" : "+ Add to Canvas"}
          </button>
          <a
            href={d.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "5px 10px", borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.03)",
              color: "#64748b", fontSize: 9.5, fontWeight: 700,
              textDecoration: "none",
            }}
          >
            ↗
          </a>
        </div>
      </div>
    </motion.div>
  );
}

// ─── SearchPanel ───────────────────────────────────────────────────────────────

export default function SearchPanel({
  sessionId,
  nodes,
  caseDescription,
  onNodesAdded,
}: SearchPanelProps) {
  const [query,            setQuery]           = useState("");
  const [results,          setResults]         = useState<SearchResultNode[]>([]);
  const [addedIds,         setAddedIds]        = useState<Set<string>>(new Set());
  const [isSearching,      setIsSearching]     = useState(false);
  const [isSmartSearching, setIsSmartSearching]= useState(false);
  const [phase,            setPhase]           = useState("");
  const [extractedQueries, setExtractedQueries]= useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // ── Manual search ────────────────────────────────────────────────────────────

  const handleManualSearch = useCallback(async () => {
    if (!sessionId || !query.trim() || isSearching) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setIsSearching(true);
    setPhase("");
    setResults([]);
    setAddedIds(new Set());
    setExtractedQueries([]);

    try {
      const res = await fetch(`${BASE}/workspace/sessions/${sessionId}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ query: query.trim(), max_results: 8 }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { nodes: SearchResultNode[]; source: string };
      setResults(data.nodes ?? []);
      setPhase(
        data.nodes.length
          ? `${data.nodes.length} judgments found${data.source === "local_db" ? " (local database)" : " from Indian Kanoon"}`
          : "No matching judgments found."
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setPhase("Search failed. Check your connection and try again.");
    } finally {
      setIsSearching(false);
    }
  }, [sessionId, query, isSearching]);

  // ── Smart search (SSE) ───────────────────────────────────────────────────────

  const handleSmartSearch = useCallback(async () => {
    if (!sessionId || isSmartSearching) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setIsSmartSearching(true);
    setPhase("Connecting…");
    setResults([]);
    setAddedIds(new Set());
    setExtractedQueries([]);

    const seen = new Set<string>();

    try {
      const res = await fetch(`${BASE}/workspace/sessions/${sessionId}/smart-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ case_description: caseDescription, nodes }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error("Stream error");

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
            const type = ev.type as string;

            if (type === "ss_phase") {
              setPhase(ev.message as string);
            } else if (type === "ss_queries") {
              setExtractedQueries(ev.queries as string[]);
              setPhase(`Running ${(ev.queries as string[]).length} targeted searches…`);
            } else if (type === "ss_searching") {
              setPhase(ev.message as string);
            } else if (type === "ss_results") {
              const incoming = (ev.nodes as SearchResultNode[]).filter(n => !seen.has(n.id));
              incoming.forEach(n => seen.add(n.id));
              setResults(prev => [...prev, ...incoming]);
            } else if (type === "ss_complete") {
              const final = (ev.nodes as SearchResultNode[]);
              // Replace with ranked final set
              setResults(final);
              final.forEach(n => seen.add(n.id));
              setPhase(`Found ${ev.total} relevant judgments, ranked by authority & recency`);
            }
          } catch { /* malformed */ }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setPhase("Smart search failed. Try manual search.");
    } finally {
      setIsSmartSearching(false);
    }
  }, [sessionId, nodes, caseDescription, isSmartSearching]);

  // ── Canvas actions ───────────────────────────────────────────────────────────

  const handleAddToCanvas = useCallback((node: SearchResultNode) => {
    onNodesAdded([node]);
    setAddedIds(prev => new Set([...prev, node.id]));
  }, [onNodesAdded]);

  const handleAddAll = useCallback(() => {
    const unadded = results.filter(r => !addedIds.has(r.id));
    if (!unadded.length) return;
    onNodesAdded(unadded);
    setAddedIds(prev => new Set([...prev, ...unadded.map(r => r.id)]));
  }, [results, addedIds, onNodesAdded]);

  const isRunning  = isSearching || isSmartSearching;
  const unadded    = results.filter(r => !addedIds.has(r.id));

  return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Header */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#14b8a6", letterSpacing: "0.04em" }}>
          🔍 Indian Kanoon Search
        </div>
        <div style={{ fontSize: 9.5, color: "#64748b", marginTop: 2 }}>
          Manual search or let AI find judgments from your canvas
        </div>
      </div>

      {/* Manual search */}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleManualSearch()}
          placeholder="Article 21, property rights, specific relief…"
          style={{
            flex: 1, background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
            padding: "8px 10px", fontSize: 10.5, color: "#e2e8f0", outline: "none",
          }}
        />
        <button
          onClick={handleManualSearch}
          disabled={isRunning || !query.trim() || !sessionId}
          style={{
            padding: "8px 12px", borderRadius: 8, border: "none",
            background: (!isSearching && query.trim()) ? "linear-gradient(135deg, #0d9488, #14b8a6)" : "rgba(20,184,166,0.08)",
            color: (!isSearching && query.trim()) ? "#fff" : "#14b8a6",
            fontWeight: 700, fontSize: 10, cursor: isRunning ? "not-allowed" : "pointer",
            flexShrink: 0,
          }}
        >
          {isSearching ? "⟳" : "Go"}
        </button>
      </div>

      {/* Smart Search button */}
      <button
        onClick={handleSmartSearch}
        disabled={isRunning || !sessionId}
        style={{
          width: "100%", padding: "9px 0", borderRadius: 8, border: "none",
          background: isSmartSearching
            ? "rgba(245,158,11,0.08)"
            : (nodes.length >= 1 ? "linear-gradient(135deg, #b45309, #f59e0b)" : "rgba(255,255,255,0.04)"),
          color: isSmartSearching ? "#f59e0b" : (nodes.length >= 1 ? "#fff" : "#475569"),
          fontWeight: 800, fontSize: 10.5, cursor: isRunning ? "not-allowed" : "pointer",
          boxShadow: (!isSmartSearching && nodes.length >= 1) ? "0 4px 14px rgba(245,158,11,0.2)" : "none",
        }}
      >
        {isSmartSearching ? "⟳ AI searching…" : `🧠 Smart Search from Canvas${nodes.length >= 1 ? ` (${nodes.length} nodes)` : ""}`}
      </button>

      {/* No nodes hint */}
      {!sessionId && (
        <div style={{ fontSize: 9.5, color: "#475569", textAlign: "center" }}>
          Open a workspace session to enable search.
        </div>
      )}
      {sessionId && nodes.length === 0 && (
        <div style={{ fontSize: 9.5, color: "#475569", textAlign: "center" }}>
          Add nodes to the canvas for Smart Search context.
        </div>
      )}

      {/* Extracted queries display */}
      <AnimatePresence>
        {extractedQueries.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div style={{ fontSize: 8.5, color: "#64748b", marginBottom: 5, fontWeight: 700 }}>
              AI-GENERATED QUERIES
            </div>
            {extractedQueries.map((q, i) => (
              <div
                key={i}
                style={{
                  fontSize: 9, color: "#94a3b8", lineHeight: 1.5,
                  padding: "4px 8px", marginBottom: 3, borderRadius: 5,
                  background: "rgba(245,158,11,0.06)",
                  border: "1px solid rgba(245,158,11,0.12)",
                }}
              >
                {i + 1}. {q}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase / status message */}
      {phase && (
        <div style={{
          fontSize: 9.5, lineHeight: 1.5,
          color: phase.toLowerCase().includes("failed") ? "#ef4444" : "#64748b",
          display: "flex", alignItems: "center", gap: 5,
        }}>
          {isRunning && (
            <motion.span
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              style={{ color: "#f59e0b" }}
            >●</motion.span>
          )}
          {phase}
        </div>
      )}

      {/* Add all button */}
      <AnimatePresence>
        {results.length > 0 && unadded.length > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={handleAddAll}
            style={{
              width: "100%", padding: "8px 0", borderRadius: 8,
              border: "1px solid rgba(20,184,166,0.3)",
              background: "rgba(20,184,166,0.08)", color: "#14b8a6",
              fontWeight: 700, fontSize: 10, cursor: "pointer",
            }}
          >
            + Add All to Canvas ({unadded.length})
          </motion.button>
        )}
      </AnimatePresence>

      {/* Result cards */}
      <AnimatePresence mode="popLayout">
        {results.map(node => (
          <ResultCard
            key={node.id}
            node={node}
            added={addedIds.has(node.id)}
            onAdd={handleAddToCanvas}
          />
        ))}
      </AnimatePresence>

      {/* Attribution */}
      {results.length > 0 && (
        <div style={{ fontSize: 8.5, color: "#334155", textAlign: "center" }}>
          Data sourced from{" "}
          <a
            href="https://indiankanoon.org"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#14b8a6", textDecoration: "none" }}
          >
            Indian Kanoon
          </a>
          . Rankings: authority × recency × citation count.
        </div>
      )}

      {/* Tips */}
      {results.length === 0 && !isRunning && !phase && (
        <div style={{
          padding: "10px 12px", borderRadius: 8,
          background: "rgba(20,184,166,0.04)",
          border: "1px solid rgba(20,184,166,0.08)",
        }}>
          <div style={{ fontSize: 9, color: "#475569", lineHeight: 1.65 }}>
            <strong style={{ color: "#14b8a6" }}>Tips:</strong><br />
            • Smart Search reads your canvas and auto-generates queries<br />
            • Manual: try "Article 21", "specific relief Act 1963"<br />
            • SC judgments rank higher than HC by default<br />
            • Results cached 24 h for speed
          </div>
        </div>
      )}
    </div>
  );
}
