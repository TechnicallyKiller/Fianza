"""x402 "exact" payment scheme for Stellar, reimplemented in Python.

There is no published Python x402-Stellar client, so this module ports the wire
protocol of ``@x402/stellar`` (v2.17) + ``@x402/core`` that the TrustLine backend
and the TypeScript SDK already speak, so a Python agent can pay an x402-priced
resource the same way.

Protocol shape (SEP-41 transfer, facilitator-sponsored):
  1. Request the resource. A 402 carries payment requirements (a base64
     ``PAYMENT-REQUIRED`` header, or an ``accepts`` array in the JSON body).
  2. Pick an "exact" requirement on a Stellar network we support.
  3. Build a Soroban ``transfer(from=agent, to=payTo, amount)`` invocation with a
     throwaway (null-account) transaction source, so the agent's ``from`` becomes
     an *address*-credential authorization entry the agent must sign (the
     facilitator, not the agent, is the tx source that pays fees and submits).
  4. Simulate, sign that auth entry with an expiration ledger, attach it, and
     serialize the transaction envelope to XDR.
  5. Retry the request with the base64 payment payload in the
     ``PAYMENT-SIGNATURE`` (v2) / ``X-PAYMENT`` (v1) header.

The facilitator rebuilds the transaction with its own source + fee sponsorship
and submits it; all it needs from us is the single InvokeHostFunction op with a
signed address-credential auth entry (see ``gatherAuthEntrySignatureStatus`` in
``@x402/stellar``).
"""

from __future__ import annotations

import base64
import json
import math
from typing import Any, Dict, Mapping, Optional

import requests
from stellar_sdk import (
    Account,
    Keypair,
    SorobanServer,
    TransactionBuilder,
    scval,
)
from stellar_sdk import xdr as stellar_xdr
from stellar_sdk.auth import authorize_entry

# ---- constants (mirrors @x402/stellar) ----

STELLAR_TESTNET_CAIP2 = "stellar:testnet"
STELLAR_PUBNET_CAIP2 = "stellar:pubnet"

_PASSPHRASES = {
    STELLAR_TESTNET_CAIP2: "Test SDF Network ; September 2015",
    STELLAR_PUBNET_CAIP2: "Public Global Stellar Network ; September 2015",
}
_DEFAULT_RPC = {
    STELLAR_TESTNET_CAIP2: "https://soroban-testnet.stellar.org",
}
# @x402/stellar samples Horizon for the live rate and falls back to 5s/ledger.
# 5s is the correct conservative default for expiration math.
DEFAULT_ESTIMATED_LEDGER_SECONDS = 5

# All-zero ed25519 account id — the canonical "read-only" tx source. Using it as
# the source (instead of the agent) is what forces the transfer's `from` to be an
# address-credential auth entry the agent signs.
NULL_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"

BASE_INCLUSION_FEE = 100  # stroops; facilitator re-sponsors, so this is nominal


def is_stellar_network(caip2: str) -> bool:
    return isinstance(caip2, str) and caip2.startswith("stellar:")


def network_passphrase(caip2: str) -> str:
    try:
        return _PASSPHRASES[caip2]
    except KeyError:
        raise ValueError(f"Unsupported Stellar network: {caip2}")


def caip2_for_passphrase(passphrase: str) -> str:
    for caip2, ph in _PASSPHRASES.items():
        if ph == passphrase:
            return caip2
    return STELLAR_TESTNET_CAIP2


def _rpc_url(caip2: str, rpc_config: Optional[Mapping[str, str]]) -> str:
    if rpc_config and rpc_config.get("url"):
        return rpc_config["url"]
    url = _DEFAULT_RPC.get(caip2)
    if not url:
        raise ValueError(
            f"No default RPC for {caip2}; pass rpc_config={{'url': ...}} "
            "(mainnet requires a custom RPC provider)."
        )
    return url


def _b64_header(obj: Any) -> str:
    """JSON -> compact string -> standard base64 (matches core safeBase64Encode)."""
    raw = json.dumps(obj, separators=(",", ":")).encode("utf-8")
    return base64.b64encode(raw).decode("ascii")


def _b64_json(data: str) -> Any:
    return json.loads(base64.b64decode(data).decode("utf-8"))


def build_exact_payment_payload(
    keypair: Keypair,
    requirements: Mapping[str, Any],
    x402_version: int,
    rpc_config: Optional[Mapping[str, str]] = None,
) -> Dict[str, Any]:
    """Build the signed ``{transaction: <xdr>}`` payload for one "exact" requirement.

    Returns the partial payload ``{"x402Version", "payload": {"transaction"}}``;
    the caller wraps it for the header (v2 adds ``resource``/``accepted``).
    """
    scheme = requirements.get("scheme")
    network = requirements.get("network")
    pay_to = requirements.get("payTo")
    asset = requirements.get("asset")
    amount = requirements.get("amount")
    extra = requirements.get("extra") or {}
    max_timeout = requirements.get("maxTimeoutSeconds", 60)

    if scheme != "exact":
        raise ValueError(f"Unsupported scheme: {scheme!r}")
    if not is_stellar_network(network):
        raise ValueError(f"Unsupported Stellar network: {network!r}")
    if not (isinstance(amount, str) and amount.lstrip("-").isdigit() and int(amount) > 0):
        raise ValueError(f"Invalid amount: {amount!r}. Must be a positive integer string.")
    if not extra.get("areFeesSponsored"):
        raise ValueError("Exact scheme requires areFeesSponsored to be true")

    passphrase = network_passphrase(network)
    server = SorobanServer(_rpc_url(network, rpc_config))
    source = keypair.public_key

    current_ledger = server.get_latest_ledger().sequence
    max_ledger = current_ledger + math.ceil(
        max_timeout / DEFAULT_ESTIMATED_LEDGER_SECONDS
    )

    # Throwaway source => the transfer's `from` (agent) needs an address-credential
    # auth entry, which is exactly what the facilitator expects the agent to sign.
    builder = (
        TransactionBuilder(
            source_account=Account(NULL_ACCOUNT, 0),
            network_passphrase=passphrase,
            base_fee=BASE_INCLUSION_FEE,
        )
        .append_invoke_contract_function_op(
            contract_id=asset,
            function_name="transfer",
            parameters=[
                scval.to_address(source),  # from
                scval.to_address(pay_to),  # to
                scval.to_int128(int(amount)),  # amount (i128)
            ],
        )
        .set_timeout(300)
    )
    tx = builder.build()

    sim = server.simulate_transaction(tx)
    if sim.error:
        raise ValueError(f"Stellar simulation failed: {sim.error}")
    if not sim.results:
        raise ValueError("Simulation returned no results")

    result = sim.results[0]
    signed_auth = []
    for auth_b64 in (result.auth or []):
        entry = stellar_xdr.SorobanAuthorizationEntry.from_xdr(auth_b64)
        cred_type = entry.credentials.type
        if cred_type == stellar_xdr.SorobanCredentialsType.SOROBAN_CREDENTIALS_ADDRESS:
            signed_auth.append(
                authorize_entry(entry, keypair, max_ledger, passphrase)
            )
        else:
            # source-account credentials need no signature
            signed_auth.append(entry)

    op = tx.transaction.operations[0]
    op.auth = signed_auth
    tx.transaction.soroban_data = stellar_xdr.SorobanTransactionData.from_xdr(
        sim.transaction_data
    )
    tx.transaction.fee = int(sim.min_resource_fee or 0) + BASE_INCLUSION_FEE

    return {
        "x402Version": x402_version,
        "payload": {"transaction": tx.to_xdr()},
    }


# ---- HTTP 402 flow (mirrors @x402/fetch wrapFetchWithPayment) ----


def _parse_payment_required(resp: requests.Response) -> Dict[str, Any]:
    header = resp.headers.get("PAYMENT-REQUIRED")
    if header:
        return _b64_json(header)
    try:
        body = resp.json()
    except ValueError:
        body = None
    if isinstance(body, dict) and "accepts" in body and "x402Version" in body:
        return body
    if isinstance(body, dict) and body.get("x402Version") == 1:
        return body
    raise ValueError("Invalid 402 response: no PAYMENT-REQUIRED header or accepts body")


def _select_requirement(
    payment_required: Mapping[str, Any],
    preferred_network: Optional[str],
) -> Dict[str, Any]:
    accepts = payment_required.get("accepts") or []
    candidates = [
        r
        for r in accepts
        if r.get("scheme") == "exact" and is_stellar_network(r.get("network"))
    ]
    if not candidates:
        raise ValueError("No 'exact' Stellar payment requirement offered by the server")
    if preferred_network:
        for r in candidates:
            if r.get("network") == preferred_network:
                return r
    return candidates[0]


def pay_with_x402(
    session: requests.Session,
    keypair: Keypair,
    method: str,
    url: str,
    *,
    headers: Optional[Mapping[str, str]] = None,
    data: Any = None,
    json_body: Any = None,
    preferred_network: Optional[str] = None,
    rpc_config: Optional[Mapping[str, str]] = None,
    timeout: Optional[float] = None,
) -> requests.Response:
    """Fetch an x402-priced ``url``, transparently paying on a 402.

    Returns the final :class:`requests.Response`. On a non-402 first response,
    returns it unchanged (no payment made).
    """
    base_headers = dict(headers or {})
    resp = session.request(
        method, url, headers=base_headers, data=data, json=json_body, timeout=timeout
    )
    if resp.status_code != 402:
        return resp

    payment_required = _parse_payment_required(resp)
    x402_version = int(payment_required.get("x402Version", 2))
    requirement = _select_requirement(payment_required, preferred_network)

    partial = build_exact_payment_payload(
        keypair, requirement, x402_version, rpc_config
    )

    if x402_version == 1:
        full_payload: Dict[str, Any] = partial
        header_name = "X-PAYMENT"
    else:
        full_payload = {
            "x402Version": x402_version,
            "payload": partial["payload"],
            "resource": payment_required.get("resource"),
            "accepted": requirement,
        }
        header_name = "PAYMENT-SIGNATURE"

    if "PAYMENT-SIGNATURE" in base_headers or "X-PAYMENT" in base_headers:
        raise ValueError("Payment already attempted (payment header present)")

    pay_headers = dict(base_headers)
    pay_headers[header_name] = _b64_header(full_payload)
    pay_headers["Access-Control-Expose-Headers"] = "PAYMENT-RESPONSE,X-PAYMENT-RESPONSE"

    return session.request(
        method, url, headers=pay_headers, data=data, json=json_body, timeout=timeout
    )
