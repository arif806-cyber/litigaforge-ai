"""Import official Act PDFs and BPR&D crosswalks into the development database."""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

import asyncpg
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
IMPORT_DIR = ROOT / "data" / "bare_acts_upload"
CROSSWALK_PATH = IMPORT_DIR / "crosswalks.json"
GOV_HOSTS = (".gov.in", ".nic.in", ".gov", ".nic")
SOURCES = {
    "constitution-india-2026.pdf": (
        "constitution-of-india",
        "Constitution of India (as on 1 May 2026)",
        "https://www.legislative.gov.in/static/uploads/2025/07/c9fe9c9b6840524844316f74bb1c556c.pdf",
    ),
    "bprd-bns-ipc-crosswalk.pdf": (
        "IPC_to_BNS", "https://bprd.nic.in/uploads/pdf/COMPARISON%20SUMMARY%20BNS%20to%20IPC%20.pdf",
    ),
    "bprd-bnss-crpc-crosswalk.pdf": (
        "CrPC_to_BNSS", "https://bprd.nic.in/uploads/pdf/Comparison%20summary%20BNSS%20to%20CrPC.pdf",
    ),
    "bprd-bsa-evidence-crosswalk.pdf": (
        "Evidence_Act_to_BSA", "https://bprd.nic.in/uploads/pdf/Comparison%20Summary%20BSA%20to%20IEA.pdf",
    ),
}


def _require_official_url(url: str) -> None:
    host = (urlparse(url).hostname or "").lower()
    if urlparse(url).scheme != "https" or not any(host == suffix[1:] or host.endswith(suffix) for suffix in GOV_HOSTS):
        raise ValueError(f"Refusing non-government source URL: {url}")


def _pdf_text(path: Path) -> tuple[str, int, str]:
    raw = path.read_bytes()
    if not raw.startswith(b"%PDF-"):
        raise ValueError(f"{path.name} is not a PDF")
    reader = PdfReader(str(path))
    pages = len(reader.pages)
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    if pages < 1 or len(text.strip()) < 1000:
        raise ValueError(f"{path.name} has no usable selectable text")
    return text, pages, hashlib.sha256(raw).hexdigest()


_SECTION = re.compile(r"^\d+[A-Za-z]?(?:\([^)]*\))*$")


def _legacy_refs(value: str) -> list[str]:
    value = value.strip().replace("–", "-").replace("—", "-")
    if not value or value.lower().startswith(("new", "-")):
        return []
    iea = re.match(r"^IEA\s+(\d+[A-Za-z]?)", value, re.I)
    if iea:
        return [iea.group(1)]
    value = value.split("  ")[0].strip().rstrip(".,;")
    # Preserve Evidence Act paragraph-level references; a bare section would be
    # an unsafe many-to-one approximation for those entries.
    para = re.match(r"^(\d+[A-Za-z]?)\s*,?\s*para(?:graph)?\s*(\d+)", value, re.I)
    if para:
        return [f"{para.group(1)}(para {para.group(2)})"]
    leading = re.match(
        r"^(\d+[A-Za-z]?(?:\([^)]*\))*(?:\s*(?:,|and|/)\s*\d+[A-Za-z]?(?:\([^)]*\))*)*)",
        value,
        re.I,
    )
    return re.findall(r"\d+[A-Za-z]?(?:\([^)]*\))*", leading.group(1)) if leading else []


def parse_crosswalk(path: Path, crosswalk_id: str, source_url: str) -> dict:
    _require_official_url(source_url)
    if not shutil.which("pdftotext"):
        raise RuntimeError("pdftotext is required to preserve official crosswalk columns")
    text = subprocess.run(
        ["pdftotext", "-layout", str(path), "-"], check=True, capture_output=True, text=True
    ).stdout
    mapping: dict[str, list[str]] = {}
    for line in text.splitlines():
        match = re.match(r"^\s*(\d+[A-Za-z]?(?:\([^)]*\))*(?:\s+\(\d+\))?)", line)
        if not match or match.start(1) >= 12:
            continue
        target = re.sub(r"\s+", "", match.group(1))
        if not _SECTION.fullmatch(target):
            continue
        columns = re.split(r"\s{2,}", line.strip())
        if crosswalk_id == "Evidence_Act_to_BSA":
            legacy_field = columns[1] if len(columns) > 1 else ""
            if len(columns) == 1 and target == "1":
                legacy_field = "1"
        elif crosswalk_id == "IPC_to_BNS":
            legacy_field = columns[2] if len(columns) > 2 else ""
            if not _legacy_refs(legacy_field) and len(columns) > 1:
                trailing = re.search(r"(\d+[A-Za-z]?(?:\([^)]*\))*)\s*[.]?$", columns[1])
                legacy_field = trailing.group(1) if trailing else legacy_field
        else:
            legacy_field = ""
            for candidate in columns[1:3]:
                if _legacy_refs(candidate):
                    legacy_field = candidate
                    break
        refs = _legacy_refs(legacy_field)
        for ref in refs:
            mapping.setdefault(ref, []).append(target)
    mapping = {key: sorted(set(values), key=lambda v: (int(re.match(r"\d+", v).group()), v))
               for key, values in mapping.items()}
    return {"mapping": mapping, "pair_count": sum(map(len, mapping.values())), "source_url": source_url}


async def _ensure_schema(conn) -> None:
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS official_act_texts (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            source_url TEXT NOT NULL,
            source_sha256 TEXT NOT NULL,
            page_count INTEGER NOT NULL,
            character_count INTEGER NOT NULL,
            extracted_text TEXT NOT NULL,
            aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
            verified_on DATE NOT NULL DEFAULT CURRENT_DATE,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    await conn.execute("ALTER TABLE official_act_texts ADD COLUMN IF NOT EXISTS aliases JSONB NOT NULL DEFAULT '[]'::jsonb")


async def _import_act(conn, path: Path, act_id: str, title: str, source_url: str, aliases: list[str] | None = None) -> None:
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,79}", act_id):
        raise ValueError("Act id must be a 2–80 character lowercase slug")
    _require_official_url(source_url)
    text, pages, digest = _pdf_text(path)
    await conn.execute(
        """INSERT INTO official_act_texts
             (id,title,source_url,source_sha256,page_count,character_count,extracted_text,aliases,verified_on)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,CURRENT_DATE)
           ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,source_url=EXCLUDED.source_url,
             source_sha256=EXCLUDED.source_sha256,page_count=EXCLUDED.page_count,
             character_count=EXCLUDED.character_count,extracted_text=EXCLUDED.extracted_text,
             aliases=EXCLUDED.aliases,
             verified_on=CURRENT_DATE,updated_at=NOW()""",
        act_id, title, source_url, digest, pages, len(text), text,
        json.dumps(aliases or []),
    )
    print(f"{act_id}: imported {pages} pages, {len(text)} characters, sha256={digest}")


async def _run(args) -> None:
    from judgment_ingest import _is_prod
    if _is_prod() or os.getenv("REPLIT_DEPLOYMENT"):
        raise RuntimeError("Official PDF imports are development-only; refusing production.")
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL is not configured")
    conn = await asyncpg.connect(dsn)
    try:
        await _ensure_schema(conn)
        if args.crosswalks:
            results = {}
            for filename, (key, source) in list(SOURCES.items())[1:]:
                results[key] = parse_crosswalk(IMPORT_DIR / filename, key, source)
                print(f"{key}: {results[key]['pair_count']} mapping pairs")
            CROSSWALK_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
            row = await conn.fetchrow("SELECT data,source_urls FROM legal_reference_tables WHERE id='criminal-code-crosswalk-in'")
            raw_data = row["data"] if row else {}
            data = json.loads(raw_data) if isinstance(raw_data, str) else dict(raw_data)
            data.update({key: value["mapping"] for key, value in results.items()})
            data["note"] = "Official BPR&D correspondence tables. Only explicit PDF mappings are included; absence means unknown."
            sources = [value["source_url"] for value in results.values()]
            await conn.execute(
                """UPDATE legal_reference_tables SET data=$1::jsonb,source_urls=$2::jsonb,
                   status='verified_official_crosswalk',verified_on=CURRENT_DATE,updated_at=NOW()
                   WHERE id='criminal-code-crosswalk-in'""",
                json.dumps(data, ensure_ascii=False), json.dumps(sources),
            )
            print(f"Saved crosswalks to {CROSSWALK_PATH}")
        if args.act:
            manifest_path = IMPORT_DIR / "sources.json"
            manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
            for path in sorted(IMPORT_DIR.glob("*.pdf")):
                if path.name.startswith("bprd-") or (args.file and path.name != args.file):
                    continue
                entry = manifest.get(path.name)
                if path.name == "constitution-india-2026.pdf":
                    act_id, title, default_url = SOURCES[path.name]
                    entry = entry or {"id": act_id, "title": title, "source_url": default_url}
                if not entry:
                    raise ValueError(f"Add {path.name} to sources.json with id, title, and official source_url")
                await _import_act(conn, path, entry["id"], entry["title"], entry["source_url"], entry.get("aliases", []))
    finally:
        await conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--crosswalks", action="store_true", help="parse/import the three BPR&D tables")
    parser.add_argument("--act", action="store_true", help="import PDFs in the folder using sources.json")
    parser.add_argument("--file", help="limit --act to one filename")
    args = parser.parse_args()
    if not args.crosswalks and not args.act:
        parser.error("Choose --crosswalks, --act, or both")
    asyncio.run(_run(args))


if __name__ == "__main__":
    main()
