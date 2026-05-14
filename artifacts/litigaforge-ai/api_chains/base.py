import os
import requests
from typing import Any, Dict

API_SETU_KEY = os.getenv("API_SETU_KEY", "")
API_SETU_SECRET = os.getenv("API_SETU_SECRET", "")
API_SETU_BASE = "https://api.sandbox.co.in"


def api_setu_headers() -> Dict[str, str]:
    return {
        "x-api-key": API_SETU_KEY,
        "x-api-secret": API_SETU_SECRET,
        "x-api-version": "1.0",
        "Content-Type": "application/json",
    }


def safe_get(url: str, headers: Dict, params: Dict = None, timeout: int = 10) -> Dict[str, Any]:
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=timeout)
        resp.raise_for_status()
        return {"success": True, "data": resp.json()}
    except requests.exceptions.HTTPError as e:
        return {"success": False, "error": f"HTTP {e.response.status_code}: {e.response.text[:200]}"}
    except requests.exceptions.ConnectionError:
        return {"success": False, "error": "Connection failed — API unreachable"}
    except requests.exceptions.Timeout:
        return {"success": False, "error": "Request timed out"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def safe_post(url: str, headers: Dict, payload: Dict, timeout: int = 10) -> Dict[str, Any]:
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=timeout)
        resp.raise_for_status()
        return {"success": True, "data": resp.json()}
    except requests.exceptions.HTTPError as e:
        return {"success": False, "error": f"HTTP {e.response.status_code}: {e.response.text[:200]}"}
    except requests.exceptions.ConnectionError:
        return {"success": False, "error": "Connection failed — API unreachable"}
    except requests.exceptions.Timeout:
        return {"success": False, "error": "Request timed out"}
    except Exception as e:
        return {"success": False, "error": str(e)}
