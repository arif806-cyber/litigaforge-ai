---
name: LitigaForge Legal Chat quality checks
description: Regression and source-verification requirements for Legal Chat prompt/model changes.
---

For every Legal Chat prompt or model change, run `cd artifacts/litigaforge-ai && python -m pytest -q tests/test_legal_chat_eval.py` first, then report the case pass rate. These are deterministic profile/prompt-policy tests, not a live provider answer-quality score; never present them as the latter.

**Why:** the user explicitly requires the Indian-law cases, including the Hyderabad rent transcript, to guard prompt/model changes and asked for honest pass-rate reporting. Telangana Act 14 of 2024 defers commencement to a separate Gazette notification, so do not treat its amended pecuniary figures as effective until the notification is verified.

**How to apply:** keep the transcript and representative Indian-law intake cases in the eval set. For court recommendations, consult the dated authority table; if current pecuniary applicability or commencement is unverified, say “check current limit” rather than supplying a figure.
