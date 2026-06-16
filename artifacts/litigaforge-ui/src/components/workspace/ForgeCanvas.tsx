import { useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  BackgroundVariant,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "./NodeTypes";

// ─── Edge defaults ─────────────────────────────────────────────────────────────
const defaultEdgeOptions = {
  style: { stroke: "#14b8a6", strokeWidth: 1.5, strokeDasharray: "5 3" },
  animated: true,
};

// ─── Mini-map node colour ──────────────────────────────────────────────────────
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

// ─── ForgeCanvas ──────────────────────────────────────────────────────────────
interface ForgeCanvasProps {
  nodes:          Node[];
  edges:          Edge[];
  onNodesChange:  OnNodesChange;
  onEdgesChange:  OnEdgesChange;
  onConnect:      (connection: Connection) => void;
}

export default function ForgeCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
}: ForgeCanvasProps) {
  // Override React Flow's CSS variables for our dark teal theme
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "forge-rf-overrides";
    style.textContent = `
      .forge-canvas .react-flow__background { background: #070d1a !important; }
      .forge-canvas .react-flow__controls { background: rgba(8,16,36,0.95) !important; border: 1px solid rgba(20,184,166,0.2) !important; border-radius: 8px !important; }
      .forge-canvas .react-flow__controls-button { background: transparent !important; border: none !important; color: #94a3b8 !important; }
      .forge-canvas .react-flow__controls-button:hover { background: rgba(20,184,166,0.1) !important; color: #14b8a6 !important; }
      .forge-canvas .react-flow__minimap { background: rgba(8,16,36,0.95) !important; border: 1px solid rgba(20,184,166,0.2) !important; border-radius: 8px !important; }
      .forge-canvas .react-flow__edge-path { stroke: #0d9488 !important; }
      .forge-canvas .react-flow__edge.selected .react-flow__edge-path { stroke: #14b8a6 !important; }
      .forge-canvas .react-flow__handle { opacity: 0; transition: opacity 0.15s; }
      .forge-canvas .react-flow__node:hover .react-flow__handle { opacity: 1; }
      .forge-canvas .react-flow__selection { background: rgba(20,184,166,0.06) !important; border: 1px solid rgba(20,184,166,0.35) !important; }
      .forge-canvas .react-flow__nodeselector { display: none; }
    `;
    if (!document.getElementById("forge-rf-overrides")) {
      document.head.appendChild(style);
    }
    return () => {
      document.getElementById("forge-rf-overrides")?.remove();
    };
  }, []);

  const handleConnect = useCallback(
    (connection: Connection) => {
      onConnect(connection);
    },
    [onConnect],
  );

  return (
    <div className="forge-canvas" style={{ flex: 1, minWidth: 0, minHeight: 0, position: "relative" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
        minZoom={0.1}
        maxZoom={2.5}
        style={{ background: "#070d1a" }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgba(20,184,166,0.12)"
        />
        <Controls
          position="bottom-right"
          showZoom
          showFitView
          showInteractive
        />
        <MiniMap
          nodeColor={miniMapNodeColor}
          nodeStrokeWidth={0}
          maskColor="rgba(7,13,26,0.85)"
          position="bottom-left"
          style={{ width: 140, height: 90 }}
        />
      </ReactFlow>

      {/* Empty state */}
      {nodes.length === 0 && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div style={{ textAlign: "center", maxWidth: 360 }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>⚖️</div>
            <h3 style={{
              color: "rgba(226,232,240,0.5)", fontSize: 16, fontWeight: 700, marginBottom: 8,
            }}>
              Your Semantic Canvas is Empty
            </h3>
            <p style={{ color: "rgba(148,163,184,0.4)", fontSize: 12, lineHeight: 1.6 }}>
              Use <strong style={{ color: "rgba(20,184,166,0.6)" }}>+ Add Node</strong> to add judgments,
              facts, arguments, or risks. Run <strong style={{ color: "rgba(20,184,166,0.6)" }}>Agent Analysis</strong> to
              let the AI build your strategy automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
