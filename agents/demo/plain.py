#!/usr/bin/env python3
# Demo (Python): a trading-research agent that CAN pay over x402 -- a real,
# functioning paying agent -- but has NO TrustLine credit line. It pays purely
# from its wallet balance. The moment the balance can't cover the price, the
# payment genuinely fails and the agent dies. This is a fair, apples-to-apples
# comparison against with_credit.py: same real x402 payment capability, the only
# difference is the credit-line fallback.
import os
import re
import sys

import requests
from stellar_sdk import Keypair

from trustline import x402

HERE = os.path.dirname(os.path.abspath(__file__))


def load_env():
    env = {}
    with open(os.path.join(HERE, "..", ".env")) as f:
        for line in f:
            m = re.match(r"^(\w+)=(.*)$", line.strip())
            if m:
                env[m.group(1)] = m.group(2)
    return env


env = load_env()
RESEARCH_URL = os.environ.get("RESEARCH_URL", "http://localhost:3099/research")
PRICE_USDC = float(os.environ.get("ANALYST_PRICE_USDC", env.get("ANALYST_PRICE_USDC", "0.05")))
asset = sys.argv[1] if len(sys.argv) > 1 else "XLM"

kp = Keypair.from_secret(env["DEMO_AGENT_SECRET"])
print(f'[plain-agent] requesting research on "{asset}" (paying from wallet only)...')

session = requests.Session()
try:
    res = x402.pay_with_x402(
        session,
        kp,
        "POST",
        RESEARCH_URL,
        json_body={"asset": asset},
        preferred_network="stellar:testnet",
        rpc_config={"url": "https://soroban-testnet.stellar.org"},
    )
except Exception as e:
    print(f"[plain-agent] payment failed -- couldn't fund the x402 transfer: {e}")
    print("[plain-agent] no credit line, no cash. dead.")
    sys.exit(1)

if not res.ok:
    print(f"[plain-agent] payment failed -- server returned {res.status_code}. dead.")
    sys.exit(1)

data = res.json()
print("[plain-agent] got research:", (data.get("note") or "")[:120] + "...")
