# BridgeX

## Open Banking Connector

Plaid-style Open Banking API Connector built with Node.js, TypeScript, and Express.
OAuth 2.0 institution linking, normalized accounts/balances/transactions, AES-256
token storage, HMAC-signed webhooks, sandbox mode, and a React admin portal.

---

## Architecture

```
  Browser / App SDK
        |
        v
  Express API :4000
        |
  ┌─────┴──────────────────────────────────┐
  |  OAuth Flow     Token Manager          |
  |  Link sessions  AES-256 encrypt/decrypt|
  |                                        |
  |  Data Service (accounts/txns/balances) |
  |  Sandbox Generator (5 institutions)    |
  |                                        |
  |  Webhook Engine (HMAC + retry cron)    |
  └─────┬──────────────────────────────────┘
        |
  ┌─────┴──────┬────────┐
  PostgreSQL   Redis     React Admin :3000
  (tokens,     (rate     (institutions,
  webhooks,    limiting) tokens, webhooks,
  apps, audit)          apps)
```

---

## Quick Start

```bash
git clone https://github.com/quantsingularity/BridgeX.git
cd BridgeX
cp .env.example .env
make up
```

| Service         | URL                          |
| --------------- | ---------------------------- |
| API             | http://localhost:4000        |
| Admin dashboard | http://localhost:3000        |
| Health check    | http://localhost:4000/health |

---

## API Reference

### Authentication

All authenticated endpoints use HTTP Basic Auth:

- Username: `client_id`
- Password: `client_secret`

Or headers: `X-Client-Id` + `X-Client-Secret`.

### Institution Linking (OAuth 2.0)

```bash
# 1. Create a link session
curl -X POST http://localhost:4000/v1/link/create \
  -H "Content-Type: application/json" \
  -d '{
    "client_id":      "sandbox_client_id",
    "client_secret":  "sandbox_client_secret",
    "institution_id": "chase"
  }'

# Returns: { link_url, state, expires_at, sandbox: true }
# Sandbox mode: link completes automatically in ~1 second

# 2. Check link status
curl -X POST http://localhost:4000/v1/link/status \
  -H "Content-Type: application/json" \
  -d '{"state": "<state from step 1>"}'

# Returns: { status: "completed", institution_id: "chase" }
```

### Unified Data Endpoints

```bash
# Get accounts (all institutions or filter by one)
curl -u sandbox_client_id:sandbox_client_secret \
  http://localhost:4000/v1/accounts?institution_id=chase

# Get balances
curl -u sandbox_client_id:sandbox_client_secret \
  http://localhost:4000/v1/balances

# Get transactions with date filter
curl -u sandbox_client_id:sandbox_client_secret \
  "http://localhost:4000/v1/transactions?start_date=2024-01-01&count=50"
```

### Webhooks

```bash
# Register a webhook
curl -u sandbox_client_id:sandbox_client_secret \
  -X POST http://localhost:4000/v1/webhooks \
  -H "Content-Type: application/json" \
  -d '{"url": "https://yourapp.com/hooks/bridgex"}'

# Returns: { webhook_secret: "..." }  <- store this for signature verification
```

Verify incoming webhook signature:

```python
# Python
import hmac, hashlib

def verify(secret, raw_body, signature_header):
    expected = "sha256=" + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)
```

```javascript
// Node.js
const { WebhooksClient } = require("bridgex-js");
const ok = WebhooksClient.verifySignature(
  secret,
  rawBody,
  req.headers["x-bridgex-signature"],
);
```

### Create an App (Admin)

```bash
curl -X POST http://localhost:4000/v1/admin/apps \
  -H "Content-Type: application/json" \
  -d '{"name": "My Fintech App", "sandbox_mode": true}'
# Returns: { client_id, client_secret }  <- store client_secret immediately
```

---

## Supported Institutions (5 Mock Adapters)

| ID                | Name            | Country |
| ----------------- | --------------- | ------- |
| `chase`           | Chase Bank      | US      |
| `wells_fargo`     | Wells Fargo     | US      |
| `bank_of_america` | Bank of America | US      |
| `barclays`        | Barclays        | GB      |
| `revolut`         | Revolut         | GB      |

---

## SDKs

### Python SDK

```bash
pip install -e sdk/python
```

```python
from bridgex_sdk import BridgeXClient

client = BridgeXClient(
    client_id     = "sandbox_client_id",
    client_secret = "sandbox_client_secret",
    base_url      = "http://localhost:4000",
)

# Link an institution (sandbox auto-completes)
link = client.link.create("chase")

# Get accounts
accounts = client.accounts.list(institution_id="chase")

# Get transactions
result = client.transactions.list(start_date="2024-01-01")
for txn in result["transactions"]:
    print(f"{txn['date']} {txn['merchantName']} {txn['amount']} {txn['currency']}")

# Register webhook
hook = client.webhooks.register("https://myapp.com/hooks")
```

### JavaScript SDK

```bash
cd sdk/javascript && npm install
```

```javascript
const { BridgeXClient } = require("./src");

const client = new BridgeXClient({
  clientId: "sandbox_client_id",
  clientSecret: "sandbox_client_secret",
  baseUrl: "http://localhost:4000",
});

async function main() {
  const link = await client.link.create("chase");
  const accounts = await client.accounts.list({ institutionId: "chase" });
  const balances = await client.balances.list();
  const txns = await client.transactions.list({ startDate: "2024-01-01" });
  console.log(txns.transactions.length, "transactions");
}
main();
```

---

## Token Security

Institution access tokens are encrypted with AES-256-CBC before storage in PostgreSQL:

- Each token gets a unique random IV prepended as hex
- Format stored: `<iv_hex>:<encrypted_hex>`
- Decryption only happens at the service layer, never exposed via API
- Set `ENCRYPTION_KEY` to a 32-character string in `.env`

---

## Rate Limiting

Redis sliding-window rate limiting per `client_id`:

- Default: 100 requests per 60 seconds
- Returns `HTTP 429` with `X-RateLimit-Remaining` header
- Configure via `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX_REQUESTS`

---

## Sandbox Mode

Set `SANDBOX_MODE=true` (default) to:

- Auto-complete OAuth flows without real bank connections
- Generate realistic deterministic mock data (seeded by `institutionId + appId`)
- Same account IDs across requests for consistency
- All 5 institutions available immediately

---

## Folder Structure

```
BridgeX/
├── Makefile
├── docker-compose.yml
├── .env.example
├── docs/openapi.yaml
│
├── server/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── __tests__/unit.test.ts
│   └── src/
│       ├── index.ts             - Express app + webhook cron
│       ├── config.ts            - Typed settings
│       ├── db.ts                - PostgreSQL pool
│       ├── adapters/
│       │   ├── institutions.ts  - 5 institution registry
│       │   └── sandbox.ts       - Deterministic mock data generator
│       ├── models/types.ts      - Canonical Account, Balance, Transaction
│       ├── middleware/
│       │   ├── auth.ts          - Basic Auth credential validation
│       │   └── rateLimit.ts     - Redis sliding-window rate limiter
│       ├── routes/
│       │   ├── index.ts         - Route registration
│       │   ├── institutions.ts
│       │   ├── link.ts          - OAuth flow + sandbox simulation
│       │   ├── accounts.ts
│       │   ├── balances.ts
│       │   ├── transactions.ts
│       │   ├── webhooks.ts
│       │   ├── apps.ts
│       │   └── admin.ts
│       ├── services/
│       │   ├── tokenService.ts  - AES-256 token store/retrieve/revoke
│       │   ├── webhookService.ts - HMAC delivery + retry
│       │   └── dataService.ts   - Unified accounts/balances/transactions
│       └── utils/
│           ├── logger.ts        - Winston structured logger
│           └── crypto.ts        - AES-256-CBC + HMAC helpers
│
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── src/
│       ├── App.jsx
│       ├── api/index.js
│       ├── components/
│       │   ├── Layout.jsx       - Sidebar navigation
│       │   └── UI.jsx           - Badge, Card, Table, Button, etc.
│       └── pages/
│           ├── Dashboard.jsx    - Stats + recent webhooks
│           ├── Institutions.jsx - 5 institution cards
│           ├── TokenHealth.jsx  - Token status table
│           ├── WebhookLogs.jsx  - Delivery history
│           └── Apps.jsx         - App management + create
│
├── sdk/
│   ├── python/
│   │   ├── setup.py
│   │   └── src/bridgex_sdk/__init__.py   - Full Python client
│   └── javascript/
│       ├── package.json
│       └── src/index.js                  - Full JS client
│
└── infra/
    └── postgres/init.sql        - Schema: apps, tokens, webhooks, audit
```

---

## Running Tests

```bash
make test
# or:
cd server && npm install && npm test
```

Test coverage (21 tests):

- AES-256 encryption/decryption round-trips
- Unique IVs per encryption
- HMAC signing consistency and secret isolation
- Institution registry (5 institutions, all fields validated)
- Sandbox data generation (deterministic, normalized, paginated, sorted)
- Currency correctness per institution country

---
