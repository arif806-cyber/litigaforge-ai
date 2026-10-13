"""Versioned legal-reference seed rows. Unknown values are intentionally null."""
from __future__ import annotations

import json
from datetime import date

TABLES = [
    {
        "id": "criminal-code-crosswalk-in",
        "category": "legacy_code_crosswalk",
        "jurisdiction": "India",
        "effective_from": "2024-07-01",
        "verified_on": "2026-10-12",
        "status": "partial",
        "sources": [
            "https://www.indiacode.nic.in/bitstream/123456789/20062/1/a202345.pdf",
            "https://www.indiacode.nic.in/bitstream/123456789/20099/1/A202346.pdf",
            "https://upload.indiacode.nic.in/view-casepdf?id=AC_CEN_5_23_00049_2023-47_1719292804654&type=act",
        ],
        "data": {
            "IPC_to_BNS": {"441": "329", "503": "351"},
            "CrPC_to_BNSS": {},
            "Evidence_Act_to_BSA": {},
            "note": "Partial table only. Never infer unmapped section numbers.",
        },
    },
    {
        "id": "court-structure-telangana",
        "category": "court_structure_and_pecuniary_limits",
        "jurisdiction": "Telangana",
        "effective_from": None,
        "verified_on": "2026-10-12",
        "status": "limits_pending_commencement_verification",
        "sources": [
            "https://law.telangana.gov.in/fileShow?fileName=%2FUploads%2FLawDepartment%2FpdfNew%2FAct%2019%20of%201972%20%20-%2014%20of%202024.pdf",
            "https://law.telangana.gov.in/fileShow?fileName=%2FUploads%2FLawDepartment%2FpdfNew%2FAct%20No%2014%20of%202024.pdf",
            "https://tshc.gov.in/documents/2024_06_21T21_24_27_rtia2019.pdf",
        ],
        "data": {
            "civil_hierarchy": ["Junior Civil Judge", "Senior Civil Judge", "District Judge"],
            "hyderabad_courts": [
                "City Civil Court, Hyderabad",
                "City Small Causes Court, Hyderabad",
                "Metropolitan Sessions Court, Hyderabad",
            ],
            "pecuniary_limits_inr": None,
            "act_14_2024_enacted_text_not_verified_as_commenced": {
                "senior_civil_judge": {"more_than_inr": 1000000, "up_to_inr": 5000000},
                "junior_civil_judge": {"up_to_inr": 1000000},
                "appeal_threshold_inr": 3500000,
            },
            "instruction": "Do not apply Act 14 of 2024 thresholds as current until its separate Telangana Gazette commencement notification is verified.",
        },
    },
    {
        "id": "court-structure-andhra-pradesh",
        "category": "court_structure_and_pecuniary_limits",
        "jurisdiction": "Andhra Pradesh",
        "effective_from": None,
        "verified_on": "2026-10-12",
        "status": "structure_seed_limits_unverified",
        "sources": [
            "https://www.indiacode.nic.in/bitstream/123456789/16592/1/act_no_19_of_1972.pdf",
        ],
        "data": {
            "civil_hierarchy": ["Junior Civil Judge", "Senior Civil Judge", "District Judge"],
            "pecuniary_limits_inr": None,
            "instruction": "Confirm current Andhra Pradesh amendments and notifications; do not infer Telangana limits.",
        },
    },
    {
        "id": "state-rent-laws",
        "category": "rent_law_names",
        "jurisdiction": "Telangana and Andhra Pradesh",
        "effective_from": None,
        "verified_on": "2026-10-12",
        "status": "names_seeded_coverage_requires_case_check",
        "sources": [
            "https://www.indiacode.nic.in/handle/123456789/8607?view_type=browse",
        ],
        "data": {
            "Telangana": "Telangana Buildings (Lease, Rent and Eviction) Control Act, 1960",
            "Andhra Pradesh": "Andhra Pradesh Buildings (Lease, Rent and Eviction) Control Act, 1960",
            "instruction": "Verify building coverage, exemptions, local amendments, and current commencement before applying.",
        },
    },
]


async def ensure_reference_tables(conn) -> None:
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS legal_reference_tables (
            id TEXT PRIMARY KEY,
            category TEXT NOT NULL,
            jurisdiction TEXT NOT NULL,
            effective_from DATE,
            verified_on DATE NOT NULL,
            status TEXT NOT NULL,
            source_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
            data JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS ai_citation_correction_log (
            id BIGSERIAL PRIMARY KEY,
            question_hash TEXT NOT NULL,
            feature TEXT NOT NULL,
            model TEXT NOT NULL,
            corrections JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    for item in TABLES:
        await conn.execute(
            """INSERT INTO legal_reference_tables
               (id, category, jurisdiction, effective_from, verified_on, status, source_urls, data)
               VALUES ($1,$2,$3,$4::date,$5::date,$6,$7::jsonb,$8::jsonb)
               ON CONFLICT (id) DO UPDATE SET
                 category=EXCLUDED.category,
                 jurisdiction=EXCLUDED.jurisdiction,
                 effective_from=EXCLUDED.effective_from,
                 verified_on=EXCLUDED.verified_on,
                 status=EXCLUDED.status,
                 source_urls=EXCLUDED.source_urls,
                 data=EXCLUDED.data,
                 updated_at=NOW()""",
            item["id"], item["category"], item["jurisdiction"],
            date.fromisoformat(item["effective_from"]) if item["effective_from"] else None,
            date.fromisoformat(item["verified_on"]), item["status"], json.dumps(item["sources"]),
            json.dumps(item["data"], ensure_ascii=False),
        )
