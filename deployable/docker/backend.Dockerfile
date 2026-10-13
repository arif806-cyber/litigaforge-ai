FROM python:3.12.8-slim-bookworm AS wheels
WORKDIR /build
COPY artifacts/litigaforge-ai/requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir=/wheels -r requirements.txt

FROM python:3.12.8-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=5000
RUN groupadd --system app && useradd --system --gid app --home-dir /app app
WORKDIR /app
COPY --from=wheels /wheels /wheels
COPY artifacts/litigaforge-ai/requirements.txt .
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt && rm -rf /wheels
COPY artifacts/litigaforge-ai/ ./
USER app
EXPOSE 5000
CMD ["python", "main.py"]
