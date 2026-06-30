"""
LitigaForge AI — Judgment Embedding Backfill Script
====================================================
Computes and stores NIM nv-embedqa-e5-v5 embeddings for all judgments that
currently have ``embedding IS NULL``.  Safe to re-run — already-embedded rows
are skipped.

Usage (run from the litigaforge-ai directory):
    cd artifacts/litigaforge-ai
    python scripts/backfill_embeddings.py [--batch-size 20] [--limit 0] [--dry-run]

Required env:
    DATABASE_URL     PostgreSQL connection string (auto-set by Replit)
    NIM_API_KEY      NVIDIA NIM API key (nvapi-..., Replit Secret)

Optional env:
    NIM_EMBED_MODEL  Embedding model (default nvidia/nv-embedqa-e5-v5)
    NIM_EMBED_BASE   API base URL (default https://integrate.api.nvidia.com/v1)
    NIM_EMBED_TIMEOUT  HTTP timeout in seconds (default 30)
"""
import argparse
import asyncio
import math
import os
import sys

DATABASE_URL = os.getenv("DATABASE_URL")
NIM_API_KEY = os.getenv("NIM_API_KEY")

if not DATABASE_URL:
    sys.exit("ERROR: DATABASE_URL not set — export it before running this script.")
if not NIM_API_KEY:
    sys.exit("ERROR: NIM_API_KEY not set — export it before running this script.")


# ── NIM embedding (self-contained, no llm package import needed) ──────────────

NIM_EMBED_MODEL = os.getenv("NIM_EMBED_MODEL", "nvidia/nv-embedqa-e5-v5")
NIM_EMBED_BASE = os.getenv("NIM_EMBED_BASE", "https://integrate.api.nvidia.com/v1").rstrip("/")
NIM_EMBED_TIMEOUT = float(os.getenv("NIM_EMBED_TIMEOUT", "30"))


def _l2_normalize(vec: list) -> list:
    norm = math.sqrt(sum(x * x for x in vec))
    if norm == 0.0:
        return vec
    inv = 1.0 / norm
    return [x * inv for x in vec]


def _vec_to_str(v: list) -> str:
    return "[" + ",".join(f"{x:.8f}" for x in v) + "]"


async def _nim_embed_passages(texts: list, session) -> list:
    """Embed a batch of passage texts. Returns list of (vec | None) per text."""
    import httpx

    results = [None] * len(texts)
    try:
        resp = await session.post(
            f"{NIM_EMBED_BASE}/embeddings",
            headers={
                "Authorization": f"Bearer {NIM_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": NIM_EMBED_MODEL,
                "input": texts,
                "input_type": "passage",
                "encoding_format": "float",
                "truncate": "END",
            },
            timeout=NIM_EMBED_TIMEOUT,
        )
        resp.raise_for_status()
        for item in resp.json().get("data") or []:
            idx = item.get("index")
            emb = item.get("embedding")
            if idx is not None and isinstance(emb, list) and emb:
                results[idx] = _l2_normalize(emb)
    except Exception as e:
        print(f"  [WARN] NIM call failed: {e}")
    return results


# ── Main backfill logic ────────────────────────────────────────────────────────

async def backfill(batch_size: int, limit: int, dry_run: bool) -> None:
    import asyncpg
    import httpx

    print(f"Connecting to database…")
    conn = await asyncpg.connect(DATABASE_URL)

    try:
        # Ensure pgvector extension + column exist (idempotent)
        try:
            await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
            await conn.execute(
                "ALTER TABLE judgments ADD COLUMN IF NOT EXISTS embedding vector(1024)"
            )
        except Exception as e:
            print(f"  [WARN] pgvector setup skipped: {e}")

        rows = await conn.fetch(
            """SELECT id, court_slug, year, slug, case_name, summary_en
               FROM judgments
               WHERE embedding IS NULL AND status = 'published'
               ORDER BY id"""
        )

        total = len(rows) if not limit else min(len(rows), limit)
        print(f"Found {len(rows)} judgment(s) without embeddings; will process {total}.")

        if total == 0:
            print("Nothing to do — all published judgments already have embeddings.")
            return

        if dry_run:
            print(f"[DRY RUN] Would embed {total} judgment(s); exiting without changes.")
            for r in rows[:total]:
                print(f"  - id={r['id']}  {r['case_name'][:70]}")
            return

        rows = rows[:total]
        processed = succeeded = failed = 0
        real_batch = min(max(1, batch_size), 20)

        async with httpx.AsyncClient() as session:
            for start in range(0, len(rows), real_batch):
                batch = rows[start:start + real_batch]
                texts = [f"{r['case_name']}. {r['summary_en'] or ''}" for r in batch]

                print(
                    f"  Embedding batch {start + 1}–{start + len(batch)}/{total}…",
                    end="", flush=True,
                )
                vecs = await _nim_embed_passages(texts, session)
                print(" done.")

                for row, vec in zip(batch, vecs):
                    processed += 1
                    if vec is None:
                        failed += 1
                        print(f"    [FAIL] id={row['id']}  {row['case_name'][:60]}")
                        continue
                    try:
                        await conn.execute(
                            "UPDATE judgments SET embedding = $1::vector WHERE id = $2",
                            _vec_to_str(vec), row["id"],
                        )
                        succeeded += 1
                        print(f"    [OK]   id={row['id']}  {row['case_name'][:60]}")
                    except Exception as e:
                        failed += 1
                        print(f"    [FAIL] id={row['id']}  store error: {e}")

        print(
            f"\nBackfill complete: {processed} processed, {succeeded} succeeded, "
            f"{failed} failed."
        )

    finally:
        await conn.close()


# ── CLI entry point ───────────────────────────────────────────────────────────

def _parse_args():
    p = argparse.ArgumentParser(
        description="Backfill NIM embeddings for judgments that have embedding IS NULL."
    )
    p.add_argument(
        "--batch-size", type=int, default=20, metavar="N",
        help="Judgments per NIM API call (max 20, default 20)",
    )
    p.add_argument(
        "--limit", type=int, default=0, metavar="N",
        help="Stop after N judgments (0 = no limit, default 0)",
    )
    p.add_argument(
        "--dry-run", action="store_true",
        help="List rows that would be embedded without making any changes",
    )
    return p.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    asyncio.run(backfill(
        batch_size=args.batch_size,
        limit=args.limit,
        dry_run=args.dry_run,
    ))
