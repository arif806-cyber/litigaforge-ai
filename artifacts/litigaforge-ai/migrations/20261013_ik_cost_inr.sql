-- Development schema migration for Indian Kanoon rupee metering and advocate calendars.
CREATE TABLE IF NOT EXISTS indian_kanoon_api_metrics (
    id BIGSERIAL PRIMARY KEY,
    endpoint TEXT NOT NULL,
    estimated_cost_usd NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE indian_kanoon_api_metrics
    ADD COLUMN IF NOT EXISTS cost_inr NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE indian_kanoon_api_metrics
    ADD COLUMN IF NOT EXISTS feature TEXT NOT NULL DEFAULT 'general';

CREATE INDEX IF NOT EXISTS idx_ik_api_metrics_created
    ON indian_kanoon_api_metrics(created_at DESC);

CREATE TABLE IF NOT EXISTS ik_ingest_state (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    last_successful_date DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS advocate_calendar_feeds (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
