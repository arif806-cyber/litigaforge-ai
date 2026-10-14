-- Applied to development by the Replit database pane; Publish propagates the
-- managed database schema to production. Do not run against production directly.
CREATE TABLE IF NOT EXISTS ecourts_api_settings (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    daily_cap_inr NUMERIC(12,2) NOT NULL DEFAULT 60,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO ecourts_api_settings(id, daily_cap_inr)
VALUES (1, 60)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS ecourts_api_daily_spend (
    day_ist DATE PRIMARY KEY,
    call_count BIGINT NOT NULL DEFAULT 0,
    estimated_inr NUMERIC(14,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ecourts_api_usage (
    day_ist DATE NOT NULL,
    endpoint TEXT NOT NULL,
    call_count BIGINT NOT NULL DEFAULT 0,
    estimated_inr NUMERIC(14,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (day_ist, endpoint)
);

CREATE TABLE IF NOT EXISTS ecourts_cause_list_cache (
    cache_key TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ecourts_cause_list_cache_expiry_idx
    ON ecourts_cause_list_cache(expires_at);
