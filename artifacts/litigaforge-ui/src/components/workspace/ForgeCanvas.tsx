import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  BackgroundVariant,
  useReactFlow,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "./NodeTypes";
import { edgeTypes, RELATIONSHIP_TYPES, type RelType } from "./EdgeTypes";

// ─── Constants ─────────────────────────────────────────────────────────────────

const TEAL   = "#14b8a6";
const DARK   = "#070d1a";
const PANEL  = "rgba(8,16,36,0.96)";
const BORDER = "rgba(20,184,166,0.18)";
const FGD    = "#94a3b8";
const FG     = "#e2e8f0";

const PROXIMITY_PX = 160;

// ─── Minimap colour ────────────────────────────────────────────────────────────

function miniMapNodeColor(node: Node) {
  const map: Record<string, string> = {
    judgment: "#0d9488",
    fact:     "#3b82f6",
    issue:    "#a855f7",
    argument: "#14b8a6",
    risk:     "#ef4444",
    strategy: "#f59e0b",
  };
  return map[node.type ?? ""] ?? "#475569";
}

// ─── Relationship Type Picker (reusable) ──────────────────────────────────────

function RelPicker({
  title,
  onPick,
  onCancel,
}: {
  title: string;
  onPick: (relType: RelType) => void;
  onCancel: () => void;
}) {
  return (
    <div style={{
      background: PANEL,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: "12px",
      minWidth: 240,
      boxShadow: "0 24px 60px rgba(0,0,0,0.8)",
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: TEAL, marginBottom: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {title}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {(Object.entries(RELATIONSHIP_TYPES) as [RelType, typeof RELATIONSHIP_TYPES[RelType]][]).map(([key, rel]) => (
          <button
            key={key}
            onClick={() => onPick(key)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 10px",
              background: `${rel.color}11`,
              border: `1px solid ${rel.color}44`,
              borderRadius: 8,
              color: rel.color,
              fontSize: 10.5,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = `${rel.color}22`;
              (e.currentTarget as HTMLButtonElement).style.borderColor = `${rel.color}99`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = `${rel.color}11`;
              (e.currentTarget as HTMLButtonElement).style.borderColor = `${rel.color}44`;
            }}
          >
            <span style={{ fontSize: 12 }}>{rel.icon}</span>
            {rel.label}
          </button>
        ))}
      </div>
      <button
        onClick={onCancel}
        style={{
          width: "100%", marginTop: 10, padding: "6px",
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 7,
          color: FGD, fontSize: 10, cursor: "pointer",
        }}
      >
        Cancel (Esc)
      </button>
    </div>
  );
}

// ─── CanvasInternals — renders inside <ReactFlow> so useReactFlow() is valid ──

interface InternalProps {
  nodes: Node[];
  edges: Edge[];
  onUndo: () => void;
  onRedo: () => void;
  onDeleteSelected: () => void;
  canUndo: boolean;
  canRedo: boolean;
  pendingConn: Connection | null;
  onConnectTyped: (conn: Connection, relType: string) => void;
  onPendingCancel: () => void;
  edgePicker: { edgeId: string; x: number; y: number } | null;
  onEdgeTypeChange: (edgeId: string, relType: string) => void;
  onEdgePickerClose: () => void;
  proximitySuggestion: { sourceId: string; targetId: string } | null;
  onProximityConnect: (sourceId: string, targetId: string) => void;
  onProximityCancel: () => void;
}

function CanvasInternals({
  nodes,
  onUndo, onRedo, onDeleteSelected,
  pendingConn, onConnectTyped, onPendingCancel,
  edgePicker, onEdgeTypeChange, onEdgePickerClose,
  proximitySuggestion, onProximityConnect, onProximityCancel,
}: InternalProps) {
  const { fitView } = useReactFlow();
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [matchCount, setMatchCount] = useState(0);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "Escape") {
        setShowSearch(false);
        setSearchText("");
        onPendingCancel();
        onEdgePickerClose();
        onProximityCancel();
        return;
      }
      if (e.key === "f" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowSearch(v => !v);
        return;
      }
      if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); onUndo(); return; }
      if ((e.key === "y" && (e.ctrlKey || e.metaKey)) || (e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
        e.preventDefault(); onRedo(); return;
      }
      if (e.key === "Delete" || e.key === "Backspace") { onDeleteSelected(); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onUndo, onRedo, onDeleteSelected, onPendingCancel, onEdgePickerClose, onProximityCancel]);

  // ── Canvas search ─────────────────────────────────────────────────────────
  function handleSearch(text: string) {
    setSearchText(text);
    if (!text.trim()) { setMatchCount(0); return; }
    const lc = text.toLowerCase();
    const matches = nodes.filter(n => {
      const d = n.data as Record<string, unknown>;
      return [d.label, d.summary, d.content, d.description, d.citation].some(
        v => v && String(v).toLowerCase().includes(lc)
      );
    });
    setMatchCount(matches.length);
    if (matches.length > 0) fitView({ nodes: matches.slice(0, 3), duration: 450, padding: 0.5 });
  }

  const panelStyle: React.CSSProperties = {
    background: PANEL, border: `1px solid ${BORDER}`,
    borderRadius: 12, padding: 12,
    boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
  };

  return (
    <>
      <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="rgba(20,184,166,0.10)" />
      <Controls position="bottom-right" showZoom showFitView showInteractive />
      <MiniMap
        nodeColor={miniMapNodeColor}
        nodeStrokeWidth={0}
        maskColor="rgba(7,13,26,0.88)"
        position="bottom-left"
        style={{ width: 144, height: 90 }}
      />

      {/* Canvas Search */}
      {showSearch && (
        <Panel position="top-center" style={{ ...panelStyle, display: "flex", gap: 8, alignItems: "center", padding: "8px 12px" }}>
          <span style={{ fontSize: 12, color: TEAL }}>🔍</span>
          <input
            autoFocus
            value={searchText}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search nodes…"
            style={{
              background: "transparent", border: "none", outline: "none",
              color: FG, fontSize: 12, width: 200,
              fontFamily: "inherit",
            }}
          />
          {searchText && (
            <span style={{ fontSize: 10, color: matchCount > 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
              {matchCount} match{matchCount !== 1 ? "es" : ""}
            </span>
          )}
          <button onClick={() => { setShowSearch(false); setSearchText(""); setMatchCount(0); }}
            style={{ background: "none", border: "none", color: FGD, cursor: "pointer", fontSize: 12 }}>✕</button>
        </Panel>
      )}

      {/* Connection Type Picker */}
      {pendingConn && (
        <Panel position="top-center" style={{ ...panelStyle, marginTop: showSearch ? 56 : 0 }}>
          <RelPicker
            title="Select Relationship Type"
            onPick={rel => onConnectTyped(pendingConn, rel)}
            onCancel={onPendingCancel}
          />
        </Panel>
      )}

      {/* Edge Re-type Picker (edge double-click) */}
      {edgePicker && (
        <Panel position="top-center" style={panelStyle}>
          <RelPicker
            title="Change Relationship Type"
            onPick={rel => { onEdgeTypeChange(edgePicker.edgeId, rel); onEdgePickerClose(); }}
            onCancel={onEdgePickerClose}
          />
        </Panel>
      )}

      {/* Proximity Suggestion */}
      {proximitySuggestion && !pendingConn && (
        <Panel position="bottom-center" style={{ ...panelStyle, padding: "10px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, color: FGD }}>
              ⚡ These nodes are close — connect them?
            </span>
            <button
              onClick={() => onProximityConnect(proximitySuggestion.sourceId, proximitySuggestion.targetId)}
              style={{
                padding: "5px 12px", borderRadius: 7, border: "none",
                background: TEAL, color: "#fff", fontWeight: 700, fontSize: 10, cursor: "pointer",
              }}
            >
              Connect
            </button>
            <button
              onClick={onProximityCancel}
              style={{
                padding: "5px 10px", borderRadius: 7,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                color: FGD, fontWeight: 700, fontSize: 10, cursor: "pointer",
              }}
            >
              Dismiss
            </button>
          </div>
        </Panel>
      )}

      {/* Keyboard hint */}
      <Panel position="top-right" style={{ padding: "5px 10px", background: "rgba(7,13,26,0.7)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ fontSize: 8.5, color: "#334155", lineHeight: 1.7 }}>
          Ctrl+F Search · Del Remove · Ctrl+Z Undo
        </div>
      </Panel>
    </>
  );
}

// ─── ForgeCanvas ──────────────────────────────────────────────────────────────

export interface ForgeCanvasProps {
  nodes:            Node[];
  edges:            Edge[];
  onNodesChange:    OnNodesChange;
  onEdgesChange:    OnEdgesChange;
  onConnectTyped:   (connection: Connection, relType: string) => void;
  onEdgeTypeChange: (edgeId: string, relType: string) => void;
  onUndo:           () => void;
  onRedo:           () => void;
  onDeleteSelected: () => void;
  canUndo:          boolean;
  canRedo:          boolean;
}

// Inject global CSS once
let cssInjected = false;
function injectCSS() {
  if (cssInjected || document.getElementById("forge-rf-css")) return;
  cssInjected = true;
  const s = document.createElement("style");
  s.id = "forge-rf-css";
  s.textContent = `
    .forge-canvas .react-flow__background { background: #070d1a !important; }
    .forge-canvas .react-flow__handle { opacity: 0 !important; transition: opacity 0.15s, transform 0.15s !important; }
    .forge-canvas .react-flow__node:hover .react-flow__handle,
    .forge-canvas .react-flow__node.selected .react-flow__handle { opacity: 1 !important; }
    .forge-canvas .react-flow__handle:hover { transform: scale(1.5) !important; }
    .forge-canvas .react-flow__controls { background: rgba(8,16,36,0.95) !important; border: 1px solid rgba(20,184,166,0.2) !important; border-radius: 10px !important; overflow: hidden; }
    .forge-canvas .react-flow__controls-button { background: transparent !important; border-bottom: 1px solid rgba(255,255,255,0.05) !important; color: #94a3b8 !important; }
    .forge-canvas .react-flow__controls-button:hover { background: rgba(20,184,166,0.1) !important; color: #14b8a6 !important; }
    .forge-canvas .react-flow__minimap { background: rgba(8,16,36,0.95) !important; border: 1px solid rgba(20,184,166,0.2) !important; border-radius: 10px !important; overflow: hidden; }
    .forge-canvas .react-flow__selection { background: rgba(20,184,166,0.05) !important; border: 1px solid rgba(20,184,166,0.3) !important; }
    .forge-canvas .react-flow__node.selected { z-index: 10 !important; }
    .forge-canvas .react-flow__panel { z-index: 20; }
  `;
  document.head.appendChild(s);
}

export default function ForgeCanvas({
  nodes, edges,
  onNodesChange, onEdgesChange,
  onConnectTyped, onEdgeTypeChange,
  onUndo, onRedo, onDeleteSelected,
  canUndo, canRedo,
}: ForgeCanvasProps) {
  injectCSS();

  // ── Pending connection (shows type picker) ────────────────────────────────
  const [pendingConn, setPendingConn] = useState<Connection | null>(null);

  // ── Edge re-type picker ───────────────────────────────────────────────────
  const [edgePicker, setEdgePicker]   = useState<{ edgeId: string; x: number; y: number } | null>(null);

  // ── Proximity suggestion ──────────────────────────────────────────────────
  const [proximitySuggestion, setProximitySuggestion] = useState<{
    sourceId: string; targetId: string;
  } | null>(null);

  // Listen for edge double-click from EdgeTypes.tsx label
  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail as { edgeId: string; x: number; y: number };
      setEdgePicker(detail);
    }
    window.addEventListener("lf-edge-retype", handler);
    return () => window.removeEventListener("lf-edge-retype", handler);
  }, []);

  // ── Intercept connect → show type picker instead of immediate add ─────────
  const handleConnect = useCallback((connection: Connection) => {
    setPendingConn(connection);
    setProximitySuggestion(null);
  }, []);

  // ── Edge double-click on path ─────────────────────────────────────────────
  const handleEdgeDblClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setEdgePicker({ edgeId: edge.id, x: 0, y: 0 });
  }, []);

  // ── Node drag stop → proximity detection ─────────────────────────────────
  const handleNodeDragStop = useCallback((_evt: MouseEvent, draggedNode: Node) => {
    if (pendingConn) return;
    for (const other of nodes) {
      if (other.id === draggedNode.id) continue;
      const dx = (other.position.x + 110) - (draggedNode.position.x + 110);
      const dy = (other.position.y + 65)  - (draggedNode.position.y + 65);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < PROXIMITY_PX) {
        const alreadyConnected = edges.some(
          e => (e.source === draggedNode.id && e.target === other.id) ||
               (e.target === draggedNode.id && e.source === other.id),
        );
        if (!alreadyConnected) {
          setProximitySuggestion({ sourceId: draggedNode.id, targetId: other.id });
          return;
        }
      }
    }
  }, [nodes, edges, pendingConn]);

  // ── Proximity "Connect" confirms connection ───────────────────────────────
  function handleProximityConnect(sourceId: string, targetId: string) {
    setProximitySuggestion(null);
    setPendingConn({ source: sourceId, target: targetId, sourceHandle: null, targetHandle: null });
  }

  return (
    <div
      className="forge-canvas"
      style={{ flex: 1, minWidth: 0, minHeight: 0, position: "relative" }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onEdgeDoubleClick={handleEdgeDblClick}
        onNodeDragStop={handleNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1.2 }}
        minZoom={0.08}
        maxZoom={3}
        style={{ background: DARK }}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: "labeled",
          data: { relType: "cites", label: "Cites", color: TEAL },
          animated: true,
        }}
        deleteKeyCode={null}
      >
        <CanvasInternals
          nodes={nodes}
          edges={edges}
          onUndo={onUndo}
          onRedo={onRedo}
          onDeleteSelected={onDeleteSelected}
          canUndo={canUndo}
          canRedo={canRedo}
          pendingConn={pendingConn}
          onConnectTyped={(conn, rel) => {
            onConnectTyped(conn, rel);
            setPendingConn(null);
          }}
          onPendingCancel={() => setPendingConn(null)}
          edgePicker={edgePicker}
          onEdgeTypeChange={onEdgeTypeChange}
          onEdgePickerClose={() => setEdgePicker(null)}
          proximitySuggestion={proximitySuggestion}
          onProximityConnect={handleProximityConnect}
          onProximityCancel={() => setProximitySuggestion(null)}
        />
      </ReactFlow>

      {/* Empty state */}
      {nodes.length === 0 && !pendingConn && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div style={{ textAlign: "center", maxWidth: 380 }}>
            <div style={{ fontSize: 52, marginBottom: 16, opacity: 0.3 }}>⚖️</div>
            <h3 style={{ color: "rgba(226,232,240,0.45)", fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
              Your Semantic Canvas is Empty
            </h3>
            <p style={{ color: "rgba(148,163,184,0.35)", fontSize: 11.5, lineHeight: 1.7 }}>
              Use <strong style={{ color: "rgba(20,184,166,0.55)" }}>+ Add Node</strong> to place judgments, facts, or arguments.<br />
              Run <strong style={{ color: "rgba(20,184,166,0.55)" }}>Agent Analysis</strong> to let AI build your strategy automatically.<br />
              <span style={{ color: "rgba(100,116,139,0.5)", fontSize: 10, marginTop: 8, display: "block" }}>
                Ctrl+F to search · Drag nodes close to auto-suggest connections
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
