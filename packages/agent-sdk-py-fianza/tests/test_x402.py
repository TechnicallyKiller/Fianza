"""Offline tests for the x402 exact-Stellar client (no network / no RPC).

Exercises header encoding, requirement selection, the 402-body parser, and the
pre-network input validation in build_exact_payment_payload.
"""

import base64
import json

import pytest
from stellar_sdk import Keypair

from fianza import x402


def test_b64_header_roundtrip_standard_base64():
    obj = {"x402Version": 2, "payload": {"transaction": "AAAA"}}
    header = x402._b64_header(obj)
    # standard base64 (not url-safe), compact JSON
    assert "-" not in header and "_" not in header
    decoded = json.loads(base64.b64decode(header))
    assert decoded == obj
    assert x402._b64_json(header) == obj


def test_network_helpers():
    assert x402.is_stellar_network("stellar:testnet")
    assert not x402.is_stellar_network("eip155:1")
    assert x402.network_passphrase("stellar:testnet") == "Test SDF Network ; September 2015"
    with pytest.raises(ValueError):
        x402.network_passphrase("stellar:nope")


def _req(network="stellar:testnet", scheme="exact"):
    return {
        "scheme": scheme,
        "network": network,
        "payTo": Keypair.random().public_key,
        "asset": "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
        "amount": "3000000",
        "maxTimeoutSeconds": 60,
        "extra": {"areFeesSponsored": True},
    }


def test_select_requirement_prefers_network():
    pr = {"accepts": [_req("stellar:pubnet"), _req("stellar:testnet")]}
    chosen = x402._select_requirement(pr, "stellar:testnet")
    assert chosen["network"] == "stellar:testnet"


def test_select_requirement_skips_non_exact_and_non_stellar():
    pr = {
        "accepts": [
            _req(scheme="upto"),
            {"scheme": "exact", "network": "eip155:1", "payTo": "0x0"},
            _req("stellar:testnet"),
        ]
    }
    chosen = x402._select_requirement(pr, None)
    assert chosen["scheme"] == "exact" and chosen["network"].startswith("stellar:")


def test_select_requirement_none_available():
    with pytest.raises(ValueError):
        x402._select_requirement({"accepts": [_req(scheme="upto")]}, None)


def test_parse_payment_required_from_header():
    body_obj = {"x402Version": 2, "accepts": [_req()]}

    class R:
        headers = {"PAYMENT-REQUIRED": x402._b64_header(body_obj)}

        def json(self):
            raise ValueError("should not be read")

    assert x402._parse_payment_required(R())["x402Version"] == 2


def test_parse_payment_required_from_body():
    body_obj = {"x402Version": 2, "accepts": [_req()]}

    class R:
        headers = {}

        def json(self):
            return body_obj

    assert x402._parse_payment_required(R()) == body_obj


def test_build_payload_requires_fees_sponsored():
    kp = Keypair.random()
    req = _req()
    req["extra"] = {"areFeesSponsored": False}
    with pytest.raises(ValueError, match="areFeesSponsored"):
        x402.build_exact_payment_payload(kp, req, 2)


def test_build_payload_rejects_bad_amount():
    kp = Keypair.random()
    req = _req()
    req["amount"] = "0"
    with pytest.raises(ValueError, match="Invalid amount"):
        x402.build_exact_payment_payload(kp, req, 2)
