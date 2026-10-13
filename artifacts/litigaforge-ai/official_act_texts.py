"""Loaded official statute text registry used by fail-closed citation checks."""
from __future__ import annotations

import json
import re

ACT_TEXTS: dict[str, str] = {}
ACT_ALIASES: dict[str, tuple[str, ...]] = {}
ALIASES = {
    "bns-2023": ("BNS", "Bharatiya Nyaya Sanhita", "Nyaya Sanhita"),
    "bnss-2023": ("BNSS", "Bharatiya Nagarik Suraksha Sanhita", "Nagarik Suraksha Sanhita"),
    "bsa-2023": ("BSA", "Bharatiya Sakshya Adhiniyam", "Sakshya Adhiniyam"),
    "constitution-of-india": ("Constitution of India", "Indian Constitution"),
    "ipc-1860": ("IPC", "Indian Penal Code"),
    "crpc-1973": ("CrPC", "Code of Criminal Procedure"),
    "iea-1872": ("IEA", "Indian Evidence Act", "Evidence Act"),
}


def _all_aliases() -> dict[str, tuple[str, ...]]:
    ids = set(ALIASES) | set(ACT_ALIASES)
    return {
        act_id: tuple(dict.fromkeys((*ALIASES.get(act_id, ()), *ACT_ALIASES.get(act_id, ()))))
        for act_id in ids
    }


def drafting_reference_instruction() -> str:
    all_aliases = _all_aliases()
    loaded = [aliases[0] for act_id, aliases in all_aliases.items() if act_id in ACT_TEXTS]
    missing = [aliases[0] for act_id, aliases in all_aliases.items() if act_id not in ACT_TEXTS]
    return (
        f"Loaded official full-text Acts: {', '.join(loaded) if loaded else 'none'}. "
        f"Not loaded: {', '.join(missing)}. Cite a section only when the corresponding full "
        "text is loaded. For an unloaded Act, state exactly 'Act text not loaded yet'; do not "
        "infer a section number from memory or a crosswalk."
    )


async def ensure_act_text_table(conn) -> None:
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS official_act_texts (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, source_url TEXT NOT NULL,
            source_sha256 TEXT NOT NULL, page_count INTEGER NOT NULL,
            character_count INTEGER NOT NULL, extracted_text TEXT NOT NULL,
            aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
            verified_on DATE NOT NULL DEFAULT CURRENT_DATE,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    await conn.execute("ALTER TABLE official_act_texts ADD COLUMN IF NOT EXISTS aliases JSONB NOT NULL DEFAULT '[]'::jsonb")
    rows = await conn.fetch("SELECT id,title,aliases,extracted_text FROM official_act_texts")
    ACT_TEXTS.clear()
    ACT_ALIASES.clear()
    for row in rows:
        ACT_TEXTS[row["id"]] = row["extracted_text"]
        extra = json.loads(row["aliases"]) if isinstance(row["aliases"], str) else row["aliases"]
        ACT_ALIASES[row["id"]] = tuple(dict.fromkeys((row["title"], *(extra or []))))


def _act_citation_warnings(response: str) -> list[str]:
    warnings = []
    sections = list(re.finditer(r"\b(?:Section|S\.)\s*(\d+[A-Za-z]?(?:\s*\(\d+\))*)", response, re.I))
    articles = list(re.finditer(r"\bArticle\s+(\d+[A-Za-z]?(?:\s*\(\d+\))*)", response, re.I))
    for act_id, aliases in _all_aliases().items():
        alias_pattern = re.compile(r"\b(?:" + "|".join(re.escape(x) for x in aliases) + r")\b", re.I)
        mentions = list(alias_pattern.finditer(response))
        if not mentions:
            continue
        refs = articles if act_id == "constitution-of-india" else sections
        refs = [
            ref for ref in refs
            if any(min(abs(ref.start() - mention.end()), abs(mention.start() - ref.end())) <= 140
                   for mention in mentions)
        ]
        if not refs:
            continue
        if act_id not in ACT_TEXTS:
            warnings.append(f"{aliases[0]}: Act text not loaded yet; section citation not verified.")
            continue
        text = ACT_TEXTS[act_id]
        for ref in sorted(set(re.sub(r"\s+", "", match.group(1)) for match in refs)):
            label = "Article" if act_id == "constitution-of-india" else "Section"
            if not re.search(rf"\b{label}\s+{re.escape(ref)}\b", text, re.I):
                warnings.append(f"{aliases[0]} {label} {ref} was not found in the loaded official text.")
    return warnings
