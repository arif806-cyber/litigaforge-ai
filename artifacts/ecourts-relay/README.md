# eCourts Relay

`api.ecourts.gov.in` only accepts connections from Indian IPs (it blocks
all cloud/CDN IP ranges including Replit and Cloudflare).

This relay runs anywhere with an Indian IP and proxies requests from the
LitigaForge backend to eCourtsIndia.

## Deploy (any Indian server/PC)

```bash
pip install fastapi uvicorn httpx
RELAY_PORT=8765 uvicorn relay:app --host 0.0.0.0 --port 8765
```

## Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY relay.py .
RUN pip install fastapi uvicorn httpx
CMD ["uvicorn", "relay:app", "--host", "0.0.0.0", "--port", "8765"]
```

## Replit secret to add after starting relay

```
ECOURTSINDIA_API_BASE = http://<your-server-ip>:8765
```

The relay forwards the `Authorization: Bearer {key}` header as-is so no
changes are needed to the LitigaForge backend. Just set the env var and
restart the LitigaForge AI workflow.
