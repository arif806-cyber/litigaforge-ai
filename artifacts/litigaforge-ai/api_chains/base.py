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


def _is_govt_prod(url: str) -> bool:
    """Indian government production APIs use self-signed cert chains — skip SSL verify."""
    return "apisetu.gov.in" in url or "gov.in" in url


def safe_get(url: str, headers: Dict, params: Dict = None, timeout: int = 10) -> Dict[str, Any]:
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=timeout,
                            verify=not _is_govt_prod(url))
        if resp.status_code == 404:
            return {
                "success": False,
                "http_status": 404,
                "error_type": "record_not_found",
                "error": f"HTTP 404: {resp.text[:300]}",
                "sandbox_connected": True,
            }
        resp.raise_for_status()
        return {"success": True, "http_status": resp.status_code, "data": resp.json(), "sandbox_connected": True}
    except requests.exceptions.HTTPError as e:
        return {
            "success": False,
            "http_status": e.response.status_code,
            "error_type": "http_error",
            "error": f"HTTP {e.response.status_code}: {e.response.text[:300]}",
            "sandbox_connected": True,
        }
    except requests.exceptions.ConnectionError:
        return {"success": False, "http_status": None, "error_type": "connection_failed", "error": "Connection failed — API unreachable", "sandbox_connected": False}
    except requests.exceptions.Timeout:
        return {"success": False, "http_status": None, "error_type": "timeout", "error": "Request timed out", "sandbox_connected": False}
    except Exception as e:
        return {"success": False, "http_status": None, "error_type": "unknown", "error": str(e), "sandbox_connected": False}


def safe_post(url: str, headers: Dict, payload: Dict, timeout: int = 10) -> Dict[str, Any]:
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=timeout,
                             verify=not _is_govt_prod(url))
        if resp.status_code == 404:
            return {
                "success": False,
                "http_status": 404,
                "error_type": "record_not_found",
                "error": f"HTTP 404: {resp.text[:300]}",
                "sandbox_connected": True,
            }
        resp.raise_for_status()
        return {"success": True, "http_status": resp.status_code, "data": resp.json(), "sandbox_connected": True}
    except requests.exceptions.HTTPError as e:
        return {
            "success": False,
            "http_status": e.response.status_code,
            "error_type": "http_error",
            "error": f"HTTP {e.response.status_code}: {e.response.text[:300]}",
            "sandbox_connected": True,
        }
    except requests.exceptions.ConnectionError:
        return {"success": False, "http_status": None, "error_type": "connection_failed", "error": "Connection failed — API unreachable", "sandbox_connected": False}
    except requests.exceptions.Timeout:
        return {"success": False, "http_status": None, "error_type": "timeout", "error": "Request timed out", "sandbox_connected": False}
    except Exception as e:
        return {"success": False, "http_status": None, "error_type": "unknown", "error": str(e), "sandbox_connected": False}
