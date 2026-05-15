from .gstin import fetch_gstin
from .gstin_live import fetch_gstin_live
from .pan import fetch_pan
from .digilocker import fetch_digilocker
from .ecourts import fetch_ecourts
from .vahan import fetch_vahan
from .sarathi import fetch_sarathi
from .bpcl_lpg import fetch_bpcl_lpg
from .meripehchaan import fetch_meripehchaan
from .mee_seva_tg import fetch_mee_seva_tg
from .transport_ts import fetch_transport_ts
from .stock_exchange import fetch_stock_exchange
from .ifsc import fetch_ifsc
from .pincode import fetch_pincode

CHAIN_MAP = {
    # ── Identity & Documents ──────────────────────────────────────────────────
    "GSTIN":        fetch_gstin_live,
    "PAN":          fetch_pan,
    "DigiLocker":   fetch_digilocker,
    "MERIPEHCHAAN": fetch_meripehchaan,
    # ── Courts ────────────────────────────────────────────────────────────────
    "eCourts":      fetch_ecourts,
    # ── Transport / Vehicle ───────────────────────────────────────────────────
    "VAHAN":        fetch_vahan,
    "SARATHI":      fetch_sarathi,
    "TRANSPORT_TS": fetch_transport_ts,
    # ── State Services ────────────────────────────────────────────────────────
    "BPCL_LPG":     fetch_bpcl_lpg,
    "MEE_SEVA_TG":  fetch_mee_seva_tg,
    # ── Finance & Markets ─────────────────────────────────────────────────────
    "STOCK_EXCHANGE": fetch_stock_exchange,
    # ── Banking & Address ─────────────────────────────────────────────────────
    "IFSC":         fetch_ifsc,
    "PINCODE":      fetch_pincode,
}

__all__ = [
    "CHAIN_MAP",
    "fetch_gstin", "fetch_gstin_live", "fetch_pan", "fetch_digilocker",
    "fetch_ecourts", "fetch_vahan", "fetch_sarathi",
    "fetch_bpcl_lpg", "fetch_meripehchaan", "fetch_mee_seva_tg",
    "fetch_transport_ts", "fetch_stock_exchange", "fetch_ifsc", "fetch_pincode",
]
