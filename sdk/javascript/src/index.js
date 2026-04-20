"use strict";

/**
 * BridgeX JavaScript SDK
 * ======================
 * npm install bridgex-js
 *
 * Usage (Node.js / browser):
 *   const { BridgeXClient } = require('bridgex-js');
 *
 *   const client = new BridgeXClient({
 *     clientId:     'bx_abc123',
 *     clientSecret: 'your_secret',
 *     baseUrl:      'http://localhost:4000',
 *   });
 *
 *   const link     = await client.link.create('chase');
 *   const accounts = await client.accounts.list({ institutionId: 'chase' });
 *   const txns     = await client.transactions.list({ startDate: '2024-01-01' });
 *   const balances = await client.balances.list();
 */

const https = require("https");
const http = require("http");
const crypto = require("crypto");

class BridgeXError extends Error {
  constructor(message, statusCode = 0) {
    super(message);
    this.name = "BridgeXError";
    this.statusCode = statusCode;
  }
}

class BridgeXAuthError extends BridgeXError {}
class BridgeXNotFoundError extends BridgeXError {}
class BridgeXRateLimitError extends BridgeXError {}

// ── HTTP helper ───────────────────────────────────────────────────────────────

function request(opts, body = null) {
  return new Promise((resolve, reject) => {
    const mod = opts.protocol === "https:" ? https : http;
    const reqBody = body ? JSON.stringify(body) : null;
    const headers = { ...opts.headers };
    if (reqBody) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(reqBody);
    }

    const req = mod.request({ ...opts, headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode === 401)
            throw new BridgeXAuthError(parsed.error || data, 401);
          if (res.statusCode === 404)
            throw new BridgeXNotFoundError(parsed.error || data, 404);
          if (res.statusCode === 429)
            throw new BridgeXRateLimitError("Rate limit exceeded", 429);
          if (res.statusCode >= 400)
            throw new BridgeXError(parsed.error || data, res.statusCode);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    if (reqBody) req.write(reqBody);
    req.end();
  });
}

// ── Sub-clients ───────────────────────────────────────────────────────────────

class InstitutionsClient {
  constructor(opts) {
    this._opts = opts;
  }

  async list() {
    const r = await request({
      ...this._opts,
      path: "/v1/institutions",
      method: "GET",
    });
    return r.institutions;
  }

  async get(institutionId) {
    return request({
      ...this._opts,
      path: `/v1/institutions/${institutionId}`,
      method: "GET",
    });
  }
}

class LinkClient {
  constructor(opts, clientId, clientSecret) {
    this._opts = opts;
    this._clientId = clientId;
    this._clientSecret = clientSecret;
  }

  async create(institutionId, redirectUri = null) {
    return request(
      { ...this._opts, path: "/v1/link/create", method: "POST" },
      {
        client_id: this._clientId,
        client_secret: this._clientSecret,
        institution_id: institutionId,
        redirect_uri: redirectUri,
      },
    );
  }

  async status(state) {
    return request(
      { ...this._opts, path: "/v1/link/status", method: "POST" },
      { state },
    );
  }

  async revoke(institutionId) {
    return request(
      { ...this._opts, path: `/v1/link/${institutionId}`, method: "DELETE" },
      { client_id: this._clientId, client_secret: this._clientSecret },
    );
  }
}

class AccountsClient {
  constructor(opts) {
    this._opts = opts;
  }

  async list({ institutionId } = {}) {
    const qs = institutionId ? `?institution_id=${institutionId}` : "";
    const r = await request({
      ...this._opts,
      path: `/v1/accounts${qs}`,
      method: "GET",
    });
    return r.accounts;
  }

  async get(accountId, institutionId) {
    const r = await request({
      ...this._opts,
      path: `/v1/accounts/${accountId}?institution_id=${institutionId}`,
      method: "GET",
    });
    return r;
  }
}

class BalancesClient {
  constructor(opts) {
    this._opts = opts;
  }

  async list({ institutionId } = {}) {
    const qs = institutionId ? `?institution_id=${institutionId}` : "";
    const r = await request({
      ...this._opts,
      path: `/v1/balances${qs}`,
      method: "GET",
    });
    return r.balances;
  }
}

class TransactionsClient {
  constructor(opts) {
    this._opts = opts;
  }

  async list({
    institutionId,
    accountId,
    startDate,
    endDate,
    count = 100,
    offset = 0,
  } = {}) {
    const params = new URLSearchParams({ count, offset });
    if (institutionId) params.set("institution_id", institutionId);
    if (accountId) params.set("account_id", accountId);
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);

    return request({
      ...this._opts,
      path: `/v1/transactions?${params}`,
      method: "GET",
    });
  }
}

class WebhooksClient {
  constructor(opts) {
    this._opts = opts;
  }

  async register(url) {
    return request(
      { ...this._opts, path: "/v1/webhooks", method: "POST" },
      { url },
    );
  }

  async get() {
    return request({ ...this._opts, path: "/v1/webhooks", method: "GET" });
  }

  async delete() {
    return request({ ...this._opts, path: "/v1/webhooks", method: "DELETE" });
  }

  async deliveries(limit = 50) {
    const r = await request({
      ...this._opts,
      path: `/v1/webhooks/deliveries?limit=${limit}`,
      method: "GET",
    });
    return r.deliveries;
  }

  static verifySignature(secret, rawBody, signatureHeader) {
    const expected =
      "sha256=" +
      crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(signatureHeader),
      );
    } catch {
      return false;
    }
  }
}

// ── Main client ───────────────────────────────────────────────────────────────

class BridgeXClient {
  /**
   * @param {object} options
   * @param {string} options.clientId
   * @param {string} options.clientSecret
   * @param {string} [options.baseUrl='http://localhost:4000']
   * @param {number} [options.timeout=30000]
   */
  constructor({
    clientId,
    clientSecret,
    baseUrl = "http://localhost:4000",
    timeout = 30000,
  }) {
    const url = new URL(baseUrl);
    const authStr = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64",
    );

    const baseOpts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      protocol: url.protocol,
      headers: {
        Authorization: `Basic ${authStr}`,
        Accept: "application/json",
        "User-Agent": "bridgex-js/0.1.0",
      },
      timeout,
    };

    this.institutions = new InstitutionsClient(baseOpts);
    this.link = new LinkClient(baseOpts, clientId, clientSecret);
    this.accounts = new AccountsClient(baseOpts);
    this.balances = new BalancesClient(baseOpts);
    this.transactions = new TransactionsClient(baseOpts);
    this.webhooks = new WebhooksClient(baseOpts);
    this._baseOpts = baseOpts;
  }

  async health() {
    return request({ ...this._baseOpts, path: "/health", method: "GET" });
  }
}

module.exports = {
  BridgeXClient,
  BridgeXError,
  BridgeXAuthError,
  BridgeXNotFoundError,
  BridgeXRateLimitError,
  WebhooksClient,
};
