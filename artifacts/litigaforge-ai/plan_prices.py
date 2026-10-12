"""Shared price source for the web pricing page and advocate subscriptions."""
import json
from pathlib import Path


_PRICE_FILE = Path(__file__).resolve().parents[2] / "shared-plan-prices.json"
with _PRICE_FILE.open(encoding="utf-8") as _file:
    _PRICE_DATA = json.load(_file)

ADVOCATE_PLAN_PRICES: dict[str, dict[str, int]] = _PRICE_DATA["advocate"]
