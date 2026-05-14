from .gstin import fetch_gstin
from .pan import fetch_pan
from .digilocker import fetch_digilocker
from .ecourts import fetch_ecourts
from .vahan import fetch_vahan
from .sarathi import fetch_sarathi
from .bpcl_lpg import fetch_bpcl_lpg
from .meripehchaan import fetch_meripehchaan
from .mee_seva_tg import fetch_mee_seva_tg
from .transport_ts import fetch_transport_ts

CHAIN_MAP = {
    "GSTIN": fetch_gstin,
    "PAN": fetch_pan,
    "DigiLocker": fetch_digilocker,
    "eCourts": fetch_ecourts,
    "VAHAN": fetch_vahan,
    "SARATHI": fetch_sarathi,
    "BPCL_LPG": fetch_bpcl_lpg,
    "MERIPEHCHAAN": fetch_meripehchaan,
    "MEE_SEVA_TG": fetch_mee_seva_tg,
    "TRANSPORT_TS": fetch_transport_ts,
}

__all__ = [
    "CHAIN_MAP",
    "fetch_gstin", "fetch_pan", "fetch_digilocker",
    "fetch_ecourts", "fetch_vahan", "fetch_sarathi",
    "fetch_bpcl_lpg", "fetch_meripehchaan", "fetch_mee_seva_tg",
    "fetch_transport_ts",
]
