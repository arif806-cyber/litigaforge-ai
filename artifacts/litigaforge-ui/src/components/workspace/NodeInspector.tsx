import { useEffect, useRef, useState } from "react";
import type { Node } from "@xyflow/react";

type NodeData = Record<string, unknown>;

export default function NodeInspector({
  node,
  onSave,
  onClose,
}: {
  node: Node;
  onSave: (data: NodeData) => void;
  onClose: () => void;
}) {
  const data = node.data as NodeData;
  const [draft, setDraft] = useState<NodeData>(data);
  const draftRef = useRef<NodeData>(data);
  useEffect(() => {
    draftRef.current = node.data as NodeData;
    setDraft(draftRef.current);
  }, [node.id, node.data]);
  const updateDraft = (key: string, value: string) => {
    const numeric = ["impact_score", "strength", "confidence", "severity"].includes(key);
    const updated = { ...draftRef.current, [key]: numeric && value !== "" ? Number(value) : value };
    draftRef.current = updated;
    setDraft(updated);
  };

  const field = (key: string, label: string, multiline = false) => (
    <label key={key} style={{ display: "grid", gap: 4, fontSize: 10, color: "#94a3b8" }}>
      {label}
      {multiline ? (
        <textarea
          value={String(draft[key] ?? "")}
          rows={4}
          onChange={e => updateDraft(key, e.target.value)}
          onBlur={() => onSave(draftRef.current)}
          onKeyDown={e => {
            if (e.key === "Escape") { e.preventDefault(); draftRef.current = data; setDraft(data); onSave(data); e.currentTarget.blur(); }
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.currentTarget.blur(); }
          }}
          style={inputStyle}
        />
      ) : (
        <input
          type={["impact_score", "strength", "confidence", "severity"].includes(key) ? "number" : "text"}
          value={String(draft[key] ?? "")}
          onChange={e => updateDraft(key, e.target.value)}
          onBlur={() => onSave(draftRef.current)}
          onKeyDown={e => {
            if (e.key === "Escape") { e.preventDefault(); draftRef.current = data; setDraft(data); onSave(data); e.currentTarget.blur(); }
            if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
          }}
          autoFocus={key === "label"}
          style={inputStyle}
        />
      )}
    </label>
  );

  const specific: Record<string, [string, string, boolean?][]> = {
    judgment: [["court", "Court"], ["date", "Date"], ["citation", "Citation"], ["summary", "Holding / summary", true]],
    fact: [["source", "Source"], ["date", "Date"], ["content", "Fact details", true]],
    issue: [["description", "Issue details", true]],
    argument: [["content", "Argument", true], ["strength", "Strength"]],
    risk: [["description", "Risk details", true], ["severity", "Severity (1–10)"], ["mitigation", "Mitigation", true]],
    strategy: [["description", "Strategy details", true], ["confidence", "Confidence"]],
  };
  const fields = specific[String(node.type)] ?? [["description", "Details", true]];

  return (
    <aside
      aria-label="Edit selected canvas node"
      style={{
        position: "absolute", zIndex: 30, right: 12, top: 12, bottom: 12,
        width: 280, maxWidth: "calc(100% - 24px)", overflowY: "auto",
        padding: 14, borderRadius: 12, border: "1px solid rgba(20,184,166,.35)",
        background: "rgba(7,13,26,.97)", boxShadow: "0 12px 40px #0009",
        display: "grid", alignContent: "start", gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ color: "#14b8a6", fontSize: 12 }}>Edit {String(node.type ?? "node")}</strong>
        <button type="button" onClick={onClose} aria-label="Close editor" style={closeStyle}>×</button>
      </div>
      {field("label", "Label")}
      {fields.map(([key, title, multiline]) => field(key, title, multiline))}
      {field("impact_score", "Impact score (0–100)")}
    </aside>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "#0b1629", color: "#e2e8f0",
  border: "1px solid #24354d", borderRadius: 6, padding: "7px 8px", fontSize: 11,
};
const closeStyle: React.CSSProperties = {
  border: 0, color: "#94a3b8", background: "transparent", fontSize: 20, cursor: "pointer",
};
