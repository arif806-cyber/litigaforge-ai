"""Archived relay entry point. All requests fail closed with HTTP 410."""
import os
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

PORT   = int(os.getenv("RELAY_PORT", 8765))

app = FastAPI(title="Archived eCourts Relay (disabled)")

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def relay(path: str, request: Request) -> Response:
    return JSONResponse(
        status_code=410,
        content={
            "error": "legacy_ecourts_relay_disabled",
            "message": "Use the eCourtsIndia Partner API integration in LitigaForge AI.",
        },
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
