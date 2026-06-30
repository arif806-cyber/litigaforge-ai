---
name: LitigaForge NIM semantic judgment search
description: pgvector + NIM nv-embedqa-e5-v5 for judgment similarity search; asyncpg wire format; 3-tier cascade pattern
---

## Setup
- pgvector `CREATE EXTENSION IF NOT EXISTS vector` works on Replit's managed PostgreSQL (confirmed 2026-06-30).
- Column: `embedding vector(1024)` on the `judgments` table.
- Index: `USING hnsw (embedding vector_cosine_ops)` — prefer hnsw over ivfflat; works on empty tables, no `lists` tuning needed.
- Both extension + column + index are wrapped in inner `try/except` so they never abort table init.

## asyncpg + pgvector wire format
asyncpg has no native `vector` codec. Pass vectors as formatted strings with an explicit SQL cast:
```python
vec_str = "[0.1,0.2,...]"   # from vec_to_str() in nim_embed.py
await conn.execute("UPDATE judgments SET embedding = $1::vector WHERE ...", vec_str, ...)
await fetch("SELECT ... , 1 - (embedding <=> $1::vector) AS similarity FROM judgments ORDER BY embedding <=> $1::vector LIMIT $2", vec_str, limit)
```
Never pass a Python list directly — asyncpg will fail to encode it as a vector type.

## Asymmetric embedding (nv-embedqa-e5-v5)
- Index documents with `input_type: "passage"`
- Embed search queries with `input_type: "query"`
- Mixing them degrades quality significantly.

**Why:** e5 models use separate projection heads for queries vs. documents (asymmetric retrieval).

**How to apply:** `aembed_passages()` for indexing, `aembed_query()` for search — both in `llm/nim_embed.py`.

## 3-tier cascade in POST /judgments/search
1. NIM semantic search (cosine distance via pgvector) — only runs if `embedded_count > 0`
2. Keyword ILIKE fallback (case_name + summary_en + outcome) — for judgments not yet embedded
3. AI-generated fallback (original Claude-hallucinated behaviour) — last resort, labelled `search_source: "ai_generated"`

Response always includes `search_source` field so callers know which tier fired.

## Backfill
`POST /admin/judgments/embed-backfill` (superuser-only) — iterates `WHERE embedding IS NULL`, embeds in batches of 20, returns `{processed, succeeded, failed}`. Safe to re-run.

## Ingest integration
New judgments embedded fire-and-forget via `asyncio.create_task(_embed_judgment(...))` after `_insert` succeeds. Never blocks ingest throughput.
