"""
BridgeX Python SDK
==================
pip install bridgex-sdk

Usage:
    from bridgex_sdk import BridgeXClient

    client = BridgeXClient(
        client_id     = "bx_abc123",
        client_secret = "your_secret",
        base_url      = "http://localhost:4000",
    )

    # Link an institution (sandbox - auto-completes)
    link = client.link.create("chase")
    print(link["link_url"])

    # Get accounts
    accounts = client.accounts.list(institution_id="chase")

    # Get transactions
    txns = client.transactions.list(start_date="2024-01-01")

    # Get balances
    balances = client.balances.list(institution_id="chase")

    # Register webhook
    client.webhooks.register("https://myapp.com/hooks/bridgex")
"""

import hashlib
import hmac
from typing import Any, Dict, List, Optional

import requests


class BridgeXError(Exception):
    def __init__(self, message: str, status_code: int = 0):
        super().__init__(message)
        self.status_code = status_code


class BridgeXNotFoundError(BridgeXError):
    pass


class BridgeXAuthError(BridgeXError):
    pass


class BridgeXRateLimitError(BridgeXError):
    pass


def _raise(response: requests.Response) -> None:
    if response.status_code == 401:
        raise BridgeXAuthError(response.text, 401)
    if response.status_code == 404:
        raise BridgeXNotFoundError(response.text, 404)
    if response.status_code == 429:
        raise BridgeXRateLimitError("Rate limit exceeded", 429)
    if response.status_code >= 400:
        raise BridgeXError(response.text, response.status_code)


# ── Sub-clients ───────────────────────────────────────────────────────────────


class InstitutionsClient:
    def __init__(self, session: requests.Session, base: str):
        self._s, self._base = session, base

    def list(self) -> List[Dict[str, Any]]:
        r = self._s.get(f"{self._base}/v1/institutions")
        _raise(r)
        return r.json()["institutions"]

    def get(self, institution_id: str) -> Dict[str, Any]:
        r = self._s.get(f"{self._base}/v1/institutions/{institution_id}")
        _raise(r)
        return r.json()


class LinkClient:
    def __init__(
        self, session: requests.Session, base: str, client_id: str, client_secret: str
    ):
        self._s = session
        self._base = base
        self._client_id = client_id
        self._client_secret = client_secret

    def create(
        self, institution_id: str, redirect_uri: Optional[str] = None
    ) -> Dict[str, Any]:
        """Initiate an institution link session. Returns link_url and state."""
        r = self._s.post(
            f"{self._base}/v1/link/create",
            json={
                "client_id": self._client_id,
                "client_secret": self._client_secret,
                "institution_id": institution_id,
                "redirect_uri": redirect_uri,
            },
        )
        _raise(r)
        return r.json()

    def status(self, state: str) -> Dict[str, Any]:
        """Check the status of a link session."""
        r = self._s.post(f"{self._base}/v1/link/status", json={"state": state})
        _raise(r)
        return r.json()

    def revoke(self, institution_id: str) -> Dict[str, Any]:
        """Revoke an institution link."""
        r = self._s.delete(
            f"{self._base}/v1/link/{institution_id}",
            json={"client_id": self._client_id, "client_secret": self._client_secret},
        )
        _raise(r)
        return r.json()


class AccountsClient:
    def __init__(self, session: requests.Session, base: str):
        self._s, self._base = session, base

    def list(self, institution_id: Optional[str] = None) -> List[Dict[str, Any]]:
        params = {}
        if institution_id:
            params["institution_id"] = institution_id
        r = self._s.get(f"{self._base}/v1/accounts", params=params)
        _raise(r)
        return r.json()["accounts"]

    def get(self, account_id: str, institution_id: str) -> Dict[str, Any]:
        r = self._s.get(
            f"{self._base}/v1/accounts/{account_id}",
            params={"institution_id": institution_id},
        )
        _raise(r)
        return r.json()


class BalancesClient:
    def __init__(self, session: requests.Session, base: str):
        self._s, self._base = session, base

    def list(self, institution_id: Optional[str] = None) -> List[Dict[str, Any]]:
        params = {}
        if institution_id:
            params["institution_id"] = institution_id
        r = self._s.get(f"{self._base}/v1/balances", params=params)
        _raise(r)
        return r.json()["balances"]


class TransactionsClient:
    def __init__(self, session: requests.Session, base: str):
        self._s, self._base = session, base

    def list(
        self,
        institution_id: Optional[str] = None,
        account_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        count: int = 100,
        offset: int = 0,
    ) -> Dict[str, Any]:
        params: Dict[str, Any] = {"count": count, "offset": offset}
        if institution_id:
            params["institution_id"] = institution_id
        if account_id:
            params["account_id"] = account_id
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date

        r = self._s.get(f"{self._base}/v1/transactions", params=params)
        _raise(r)
        return r.json()


class WebhooksClient:
    def __init__(self, session: requests.Session, base: str):
        self._s, self._base = session, base

    def register(self, url: str) -> Dict[str, Any]:
        r = self._s.post(f"{self._base}/v1/webhooks", json={"url": url})
        _raise(r)
        return r.json()

    def get(self) -> Dict[str, Any]:
        r = self._s.get(f"{self._base}/v1/webhooks")
        _raise(r)
        return r.json()

    def delete(self) -> None:
        r = self._s.delete(f"{self._base}/v1/webhooks")
        _raise(r)

    def deliveries(self, limit: int = 50) -> List[Dict[str, Any]]:
        r = self._s.get(f"{self._base}/v1/webhooks/deliveries", params={"limit": limit})
        _raise(r)
        return r.json()["deliveries"]

    @staticmethod
    def verify_signature(secret: str, payload: bytes, signature: str) -> bool:
        """Verify an incoming webhook signature (X-BridgeX-Signature header)."""
        expected = (
            "sha256=" + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
        )
        return hmac.compare_digest(expected, signature)


# ── Main client ───────────────────────────────────────────────────────────────


class BridgeXClient:
    """
    BridgeX Open Banking SDK client.

    Parameters
    ----------
    client_id     : Your BridgeX app client ID
    client_secret : Your BridgeX app client secret
    base_url      : API base URL (default: http://localhost:4000)
    timeout       : Request timeout in seconds (default: 30)
    """

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        base_url: str = "http://localhost:4000",
        timeout: int = 30,
    ):
        self._base = base_url.rstrip("/")
        self._client_id = client_id
        self._client_secret = client_secret
        self._timeout = timeout

        self._session = requests.Session()
        self._session.auth = (client_id, client_secret)
        self._session.headers.update(
            {
                "User-Agent": "bridgex-python-sdk/0.1.0",
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
        )
        self._session.request = self._with_timeout(self._session.request)  # type: ignore

        self.institutions = InstitutionsClient(self._session, self._base)
        self.link = LinkClient(self._session, self._base, client_id, client_secret)
        self.accounts = AccountsClient(self._session, self._base)
        self.balances = BalancesClient(self._session, self._base)
        self.transactions = TransactionsClient(self._session, self._base)
        self.webhooks = WebhooksClient(self._session, self._base)

    def _with_timeout(self, original_request):
        timeout = self._timeout

        def request_with_timeout(*args, **kwargs):
            kwargs.setdefault("timeout", timeout)
            return original_request(*args, **kwargs)

        return request_with_timeout

    def health(self) -> Dict[str, Any]:
        r = self._session.get(f"{self._base}/health")
        return r.json()

    def __repr__(self) -> str:
        return f"BridgeXClient(client_id={self._client_id!r}, base_url={self._base!r})"
