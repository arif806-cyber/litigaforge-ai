"""Fictional, repeatable Forge Workspace fixture for the isolated demo advocate."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

DEMO_TITLE = "Demo Matter — Interim Relief Exercise"
DEMO_DESCRIPTION = (
    "FICTIONAL TRAINING EXERCISE ONLY. Aster Components LLP asks for interim "
    "relief against a hypothetical notice and proposed transfer. The parties, "
    "events, dates, documents, and dispute are invented. No real authority or "
    "court record is supplied. Treat all propositions as unverified practice "
    "material; do not infer an actual case or legal rule."
)
DEMO_NODES = [
    {"id": "demo-fact-1", "type": "fact", "position": {"x": 80, "y": 100},
     "data": {"label": "Draft notice received (fictional)", "description": "Training scenario: a fictional notice is said to have arrived on 12 March. No delivery proof is included.", "impact_score": 45}},
    {"id": "demo-issue-1", "type": "issue", "position": {"x": 390, "y": 100},
     "data": {"label": "Was notice properly served?", "description": "Practice question only. Identify the record needed to verify service.", "impact_score": 50}},
    {"id": "demo-risk-1", "type": "risk", "position": {"x": 390, "y": 320},
     "data": {"label": "Service record is missing", "description": "Fictional training risk: no dispatch receipt, tracking record, or affidavit is supplied.", "impact_score": 35}},
    {"id": "demo-strategy-1", "type": "strategy", "position": {"x": 700, "y": 210},
     "data": {"label": "Request the underlying record", "description": "Practice step: list the records to request before drawing a conclusion.", "impact_score": 55}},
]
DEMO_EDGES = [
    {"id": "demo-edge-1", "source": "demo-fact-1", "target": "demo-issue-1", "type": "labeled",
     "data": {"label": "raises", "relType": "supports"}},
    {"id": "demo-edge-2", "source": "demo-issue-1", "target": "demo-risk-1", "type": "labeled",
     "data": {"label": "uncertainty", "relType": "challenges"}},
]
DEMO_DOCUMENTS = {
    "fictional-notice.txt": (
        "LITIGAFORGE DEMO — FICTIONAL TRAINING DOCUMENT\n"
        "Not a real notice, case, person, authority, or court record.\n\n"
        "ASTER COMPONENTS LLP (fictional)\n"
        "Practice notice dated 12 March [fictional year]\n"
        "The hypothetical sender proposes a transfer of an unidentified asset.\n"
        "The notice refers to a response deadline but supplies no proof of service.\n"
        "Training prompt: identify the missing record and questions to verify.\n"
    ),
    "fictional-client-instructions.txt": (
        "LITIGAFORGE DEMO — FICTIONAL TRAINING DOCUMENT\n"
        "All entities, people, events, and dates below are invented.\n\n"
        "Client: Aster Components LLP (fictional)\n"
        "Instruction: seek advice about a hypothetical transfer and interim relief.\n"
        "The client says it received a notice on 12 March, but cannot locate the envelope.\n"
        "No contract, title document, delivery proof, or authentic legal authority is supplied.\n"
        "Training prompt: separate client assertion, established fact, and unknown.\n"
    ),
}


def _fixture_dir(folder_id: int) -> Path:
    return Path(__file__).resolve().parent / "uploads" / "folders" / str(folder_id)


async def create_demo_fixture(conn, user_id: int) -> int:
    session = await conn.fetchrow(
        """INSERT INTO workspace_sessions
           (user_id,title,case_description,nodes_json,edges_json,is_demo_fixture)
           VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,TRUE) RETURNING id""",
        user_id, DEMO_TITLE, DEMO_DESCRIPTION,
        json.dumps(DEMO_NODES), json.dumps(DEMO_EDGES),
    )
    sid = int(session["id"])
    folder = await conn.fetchrow(
        """INSERT INTO case_folders (user_id,session_id,folder_name,case_description)
           VALUES ($1,$2,$3,$4) RETURNING id""",
        user_id, sid, "Demo documents — fictional", DEMO_DESCRIPTION,
    )
    folder_id = int(folder["id"])
    folder_dir = _fixture_dir(folder_id)
    folder_dir.mkdir(parents=True, exist_ok=True)
    for name, content in DEMO_DOCUMENTS.items():
        path = folder_dir / name
        path.write_text(content, encoding="utf-8")
        await conn.execute(
            """INSERT INTO folder_documents
               (folder_id,filename,doc_type,file_path,file_size_bytes,notes)
               VALUES ($1,$2,'txt',$3,$4,'Fictional demo fixture')""",
            folder_id, name, str(path), path.stat().st_size,
        )
    return sid


async def reset_demo_fixture(conn, user_id: int) -> int:
    """Replace only rows tagged as this user's demo fixture; never other matters."""
    old_folder_ids: list[int] = []
    async with conn.transaction():
        sessions = await conn.fetch(
            "SELECT id FROM workspace_sessions WHERE user_id=$1 AND is_demo_fixture=TRUE",
            user_id,
        )
        session_ids = [int(row["id"]) for row in sessions]
        if session_ids:
            folders = await conn.fetch(
                "SELECT id FROM case_folders WHERE user_id=$1 AND session_id=ANY($2::int[])",
                user_id, session_ids,
            )
            old_folder_ids = [int(row["id"]) for row in folders]
            await conn.execute(
                "DELETE FROM case_folders WHERE user_id=$1 AND session_id=ANY($2::int[])",
                user_id, session_ids,
            )
            await conn.execute(
                "DELETE FROM workspace_sessions WHERE user_id=$1 AND is_demo_fixture=TRUE",
                user_id,
            )
        new_session_id = await create_demo_fixture(conn, user_id)

    # Retire the old fixture files only after the replacement rows committed.
    # If SQL or file creation fails, the previous DB rows and files remain intact.
    base = (Path(__file__).resolve().parent / "uploads" / "folders").resolve()
    for folder_id in old_folder_ids:
        folder_dir = _fixture_dir(folder_id).resolve()
        if folder_dir.parent == base:
            shutil.rmtree(folder_dir, ignore_errors=True)
    return new_session_id
