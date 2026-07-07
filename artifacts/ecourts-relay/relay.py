"""
eCourts Relay — minimal FastAPI proxy.

Deploy this on any server with an Indian IP (where api.ecourts.gov.in is reachable).
It proxies /case/cnr/{cnr} → api.ecourts.gov.in, forwarding the Bearer token as-is.

Usage:
  pip install fastapi uvicorn httpx
  RELAY_PORT=8765 uvicorn relay:app

Then set in Replit Secrets:
  ECOURTSINDIA_API_BASE = http://<your-server-ip>:8765
"""
import os
import httpx
from fastapi import FastAPI, Request, Response

TARGET = "https://api.ecourts.gov.in/api/ords/ecourt"
PORT   = int(os.getenv("RELAY_PORT", 8765))

app = FastAPI(title="eCourts Relay")

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def relay(path: str, request: Request) -> Response:
    target_url = f"{TARGET}/{path.lstrip('/')}"
    if request.url.query:
        target_url += f"?{request.url.query}"

    headers = {k: v for k, v in request.headers.items()
               if k.lower() not in ("host", "content-length")}
    body = await request.body()

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.request(
            method=request.method,
            url=target_url,
            headers=headers,
            content=body or None,
        )

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=dict(resp.headers),
        media_type=resp.headers.get("content-type"),
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
