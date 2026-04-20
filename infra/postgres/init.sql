-- BridgeX Open Banking Connector - Database Schema

-- Connected apps (API clients)
CREATE TABLE IF NOT EXISTS apps (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    client_id     TEXT NOT NULL UNIQUE,
    client_secret TEXT NOT NULL,
    webhook_url   TEXT,
    webhook_secret TEXT,
    sandbox_mode  BOOLEAN NOT NULL DEFAULT TRUE,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Institution link sessions (OAuth flow state)
CREATE TABLE IF NOT EXISTS link_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id          UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    institution_id  TEXT NOT NULL,
    state           TEXT NOT NULL UNIQUE,
    code_verifier   TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    -- pending | completed | expired | failed
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Institution tokens (AES-256 encrypted)
CREATE TABLE IF NOT EXISTS institution_tokens (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id               UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    institution_id       TEXT NOT NULL,
    institution_name     TEXT NOT NULL,
    encrypted_access_token  TEXT NOT NULL,
    encrypted_refresh_token TEXT,
    token_expires_at     TIMESTAMPTZ,
    scopes               TEXT[] DEFAULT '{}',
    status               TEXT NOT NULL DEFAULT 'active',
    -- active | expired | revoked | error
    last_used_at         TIMESTAMPTZ,
    last_refreshed_at    TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (app_id, institution_id)
);

CREATE INDEX IF NOT EXISTS idx_tokens_app     ON institution_tokens(app_id);
CREATE INDEX IF NOT EXISTS idx_tokens_status  ON institution_tokens(status);

-- Webhook deliveries log
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id        UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    event_type    TEXT NOT NULL,
    payload       JSONB NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending',
    -- pending | delivered | failed | retrying
    attempts      INT NOT NULL DEFAULT 0,
    response_code INT,
    response_body TEXT,
    next_retry_at TIMESTAMPTZ,
    delivered_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_app    ON webhook_deliveries(app_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhook_deliveries(status, next_retry_at);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
    id         BIGSERIAL PRIMARY KEY,
    app_id     UUID REFERENCES apps(id),
    action     TEXT NOT NULL,
    resource   TEXT,
    ip_address TEXT,
    details    JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_app ON audit_log(app_id, created_at DESC);

-- Seed a default sandbox app
INSERT INTO apps (id, name, client_id, client_secret, sandbox_mode) VALUES
    ('00000000-0000-0000-0000-000000000001',
     'BridgeX Sandbox App',
     'sandbox_client_id',
     'sandbox_client_secret',
     true)
ON CONFLICT DO NOTHING;
