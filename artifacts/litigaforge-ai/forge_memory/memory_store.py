"""
Persistent Forge Memory — stores case patterns, chain results, and learned strategies.
Backed by a local JSON file. Thread-safe for single-process use.
"""
import json
import os
import threading
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

MEMORY_FILE = os.getenv("FORGE_MEMORY_PATH", "forge_memory_store.json")
_lock = threading.Lock()


class ForgeMemory:
    def __init__(self, path: str = MEMORY_FILE):
        self.path = Path(path)
        self._ensure_file()

    def _ensure_file(self):
        if not self.path.exists():
            self._write({"patterns": [], "cases": [], "watch_list": []})

    def _read(self) -> Dict:
        with _lock:
            try:
                return json.loads(self.path.read_text())
            except (json.JSONDecodeError, FileNotFoundError):
                return {"patterns": [], "cases": [], "watch_list": []}

    def _write(self, data: Dict):
        with _lock:
            self.path.write_text(json.dumps(data, indent=2, default=str))

    def save_pattern(self, prompt: str, chains_used: List[str], suggestions: List[str], outcome_summary: str):
        data = self._read()
        data["patterns"].append({
            "id": len(data["patterns"]) + 1,
            "timestamp": datetime.utcnow().isoformat(),
            "prompt_snippet": prompt[:150],
            "chains_used": chains_used,
            "meta_suggestions": suggestions,
            "outcome_summary": outcome_summary[:300],
        })
        data["patterns"] = data["patterns"][-500:]
        self._write(data)

    def save_case(self, case_id: str, prompt: str, api_results: Dict, final_output: str):
        data = self._read()
        data.setdefault("cases", [])
        data["cases"].append({
            "case_id": case_id,
            "timestamp": datetime.utcnow().isoformat(),
            "prompt": prompt,
            "api_results": api_results,
            "final_output": final_output,
        })
        data["cases"] = data["cases"][-200:]
        self._write(data)

    def get_relevant_patterns(self, prompt: str, limit: int = 5) -> List[Dict]:
        data = self._read()
        keywords = set(prompt.lower().split())
        scored = []
        for p in data.get("patterns", []):
            snippet = p.get("prompt_snippet", "").lower()
            score = sum(1 for kw in keywords if kw in snippet)
            if score > 0:
                scored.append((score, p))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [p for _, p in scored[:limit]]

    def get_all_patterns(self) -> List[Dict]:
        return self._read().get("patterns", [])

    def get_case(self, case_id: str) -> Optional[Dict]:
        for c in self._read().get("cases", []):
            if c["case_id"] == case_id:
                return c
        return None

    def get_recent_cases(self, limit: int = 10) -> List[Dict]:
        return self._read().get("cases", [])[-limit:]

    def add_to_watch_list(self, watch_item: Dict):
        data = self._read()
        watch_item["added_at"] = datetime.utcnow().isoformat()
        watch_item["active"] = True
        data["watch_list"].append(watch_item)
        self._write(data)

    def get_watch_list(self, active_only: bool = True) -> List[Dict]:
        items = self._read().get("watch_list", [])
        return [w for w in items if w.get("active", True)] if active_only else items

    def deactivate_watch(self, watch_id: str):
        data = self._read()
        for w in data.get("watch_list", []):
            if w.get("id") == watch_id:
                w["active"] = False
        self._write(data)

    def stats(self) -> Dict:
        data = self._read()
        return {
            "total_patterns": len(data.get("patterns", [])),
            "total_cases": len(data.get("cases", [])),
            "active_watches": len([w for w in data.get("watch_list", []) if w.get("active")]),
        }
