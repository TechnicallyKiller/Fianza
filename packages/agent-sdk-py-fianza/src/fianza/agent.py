"""``FianzaAgent`` -- the interface an AI agent uses to take and repay
revenue-underwritten credit on Fianza (Stellar), settled in USDC.

Python port of ``packages/agent-sdk/src/index.ts``. An agent holds its own
Stellar key, so the whole lifecycle is agent-driven::

    tl = FianzaAgent(secret, api_base_url=..., contracts=...)
    tl.register()
    tl.underwrite()                 # backend scores + publishes on-chain
    terms = tl.credit_line()
    tl.borrow(5)  # ...work...  tl.repay(5)

On-chain writes (register/borrow/repay/deposit) are signed by the agent's own
key. Reads (credit_line/vault_state) are simulate-only. Scoring/underwriting is
delegated to the Fianza backend (the trusted underwriter, v1).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Mapping, Optional
from urllib.parse import urlencode

import requests
from stellar_sdk import (
    Account,
    Keypair,
    SorobanServer,
    TransactionBuilder,
    scval,
)
from stellar_sdk import xdr as stellar_xdr
from stellar_sdk.soroban_rpc import GetTransactionStatus, SendTransactionStatus

from .errors import ApiError, TxError
from .util import (
    assert_positive_amount,
    assert_valid_address,
    credit_shortfall_usdc,
    from_stroops,
    to_stroops,
)
from . import x402 as _x402

TESTNET_PASSPHRASE = "Test SDF Network ; September 2015"
TESTNET_RPC = "https://soroban-testnet.stellar.org"
DEFAULT_API_BASE_URL = "http://localhost:8787"
BASE_FEE = 100
NULL_ACCOUNT = _x402.NULL_ACCOUNT


@dataclass
class CreditTerms:
    tier: int  # Tier enum from the contract (0 = Unrated)
    limit_usdc: float  # Maximum outstanding principal, in USDC
    apr_bps: int  # Fixed APR, basis points


@dataclass
class VaultState:
    liquidity_usdc: float
    principal_usdc: float
    amount_owed_usdc: float
    total_assets_usdc: float  # liquidity + principal deployed (reserve excluded)
    yield_pool_usdc: float
    limit_usdc: float
    apr_bps: int


@dataclass
class TxResult:
    tx_hash: str
    return_value: Any
    explorer_url: str


class FianzaAgent:
    def __init__(
        self,
        secret: str,
        *,
        rpc_url: Optional[str] = None,
        network_passphrase: Optional[str] = None,
        api_base_url: Optional[str] = None,
        contracts: Optional[Mapping[str, str]] = None,
        session: Optional[requests.Session] = None,
    ) -> None:
        self.keypair = Keypair.from_secret(secret)
        self.passphrase = network_passphrase or TESTNET_PASSPHRASE
        self.rpc_url = rpc_url or TESTNET_RPC
        self.server = SorobanServer(self.rpc_url)
        self.api_base_url = (api_base_url or DEFAULT_API_BASE_URL).rstrip("/")
        self._opt_contracts: Dict[str, str] = dict(contracts or {})
        self._contracts: Optional[Dict[str, str]] = None
        self._usdc_sac: Optional[str] = None
        self._session = session or requests.Session()
        c = self._opt_contracts
        if c.get("registry") and c.get("creditLine") and c.get("vault"):
            self._contracts = {
                "registry": c["registry"],
                "creditLine": c["creditLine"],
                "vault": c["vault"],
            }

    # ---- identity ----

    def public_key(self) -> str:
        return self.keypair.public_key

    # ---- config resolution ----

    def ensure_contracts(self) -> Dict[str, str]:
        """Resolve contract ids (from opts or the backend ``/config``), cached."""
        if self._contracts:
            return self._contracts
        cfg = self._api_get("/config")
        c = {
            "registry": self._opt_contracts.get("registry")
            or cfg.get("scoreRegistryContractId"),
            "creditLine": self._opt_contracts.get("creditLine")
            or cfg.get("creditLineContractId"),
            "vault": self._opt_contracts.get("vault")
            or cfg.get("lendingVaultContractId"),
        }
        if not (c["registry"] and c["creditLine"] and c["vault"]):
            raise ValueError(
                "Fianza contract ids unavailable from /config -- pass them via "
                "contracts={...}."
            )
        self._contracts = c
        return c

    def usdc_sac(self) -> str:
        """USDC Stellar Asset Contract id (from the backend ``/config``), cached."""
        if self._usdc_sac:
            return self._usdc_sac
        cfg = self._api_get("/config")
        sac = cfg.get("usdcSac")
        if not sac:
            raise ValueError("usdcSac unavailable from /config")
        self._usdc_sac = sac
        return sac

    # ---- underwriting (delegated to the backend) ----

    def revenue(self, from_ledger: Optional[int] = None) -> Any:
        """Live x402 revenue index for this agent."""
        q = f"?fromLedger={from_ledger}" if from_ledger else ""
        return self._api_get(f"/agent/{self.public_key()}/revenue{q}")

    def underwrite(
        self,
        *,
        skip_proof: bool = False,
        from_ledger: Optional[int] = None,
    ) -> Any:
        """Run the full underwriting pass (revenue -> proof -> score -> publish)."""
        params: Dict[str, str] = {}
        if skip_proof:
            params["skipProof"] = "true"
        if from_ledger:
            params["fromLedger"] = str(from_ledger)
        qs = f"?{urlencode(params)}" if params else ""
        return self._api_post(f"/agent/{self.public_key()}/underwrite{qs}")

    def onboard(
        self,
        *,
        skip_proof: bool = False,
        from_ledger: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Register on-chain, then run an underwriting pass."""
        register = self.register()
        underwrite = self.underwrite(skip_proof=skip_proof, from_ledger=from_ledger)
        return {"register": register, "underwrite": underwrite}

    # ---- on-chain reads (simulate-only) ----

    def credit_line(self) -> CreditTerms:
        c = self.ensure_contracts()
        t = self._read(c["creditLine"], "terms", [self._addr(self.public_key())]) or {}
        return CreditTerms(
            tier=int(t["tier"]),
            limit_usdc=from_stroops(t["limit"]),
            apr_bps=int(t["apr_bps"]),
        )

    def vault_state(self) -> VaultState:
        c = self.ensure_contracts()
        s = self._read(c["vault"], "state", [self._addr(self.public_key())]) or {}
        return VaultState(
            liquidity_usdc=from_stroops(s["liquidity"]),
            principal_usdc=from_stroops(s["principal"]),
            amount_owed_usdc=from_stroops(s["amount_owed"]),
            total_assets_usdc=from_stroops(s["total_assets"]),
            yield_pool_usdc=from_stroops(s["yield_pool"]),
            limit_usdc=from_stroops(s["limit"]),
            apr_bps=int(s["apr_bps"]),
        )

    def available_credit_usdc(self) -> float:
        """Remaining drawable credit (limit - outstanding principal), in USDC."""
        c = self.ensure_contracts()
        v = self._read(
            c["vault"], "available_credit", [self._addr(self.public_key())]
        )
        return from_stroops(v) if v is not None else 0.0

    def usdc_balance_usdc(self) -> float:
        """This agent's spendable USDC balance (SAC ``balance``), in USDC."""
        sac = self.usdc_sac()
        v = self._read(sac, "balance", [self._addr(self.public_key())])
        return from_stroops(v) if v is not None else 0.0

    # ---- draw-on-402 ----

    def pay_with_credit(
        self,
        url: str,
        price_usdc: float,
        *,
        max_draw: Optional[float] = None,
        method: str = "GET",
        headers: Optional[Mapping[str, str]] = None,
        data: Any = None,
        json_body: Any = None,
        rpc_config: Optional[Mapping[str, str]] = None,
        timeout: Optional[float] = None,
    ) -> requests.Response:
        """Pay for an x402 resource, auto-drawing any shortfall from the credit
        line first.

        The agent never "decides to borrow" -- it just transacts, and the line
        silently covers what its cash can't. Returns the final
        :class:`requests.Response`.

        :param price_usdc: the resource price in USDC (the agent knows what it's buying)
        :param max_draw: optional cap on how much credit a single call may draw
                         (raises :class:`~fianza.errors.MaxDrawExceededError`)
        """
        bal = self.usdc_balance_usdc()
        need = credit_shortfall_usdc(bal, price_usdc, max_draw)
        if need > 0:
            self.borrow(need)
        caip = (
            _x402.STELLAR_TESTNET_CAIP2
            if self.passphrase == TESTNET_PASSPHRASE
            else _x402.STELLAR_PUBNET_CAIP2
        )
        rc = dict(rpc_config or {})
        rc.setdefault("url", self.rpc_url)
        return _x402.pay_with_x402(
            self._session,
            self.keypair,
            method,
            url,
            headers=headers,
            data=data,
            json_body=json_body,
            preferred_network=caip,
            rpc_config=rc,
            timeout=timeout,
        )

    # ---- on-chain writes (signed by this agent) ----

    def register(self) -> TxResult:
        """Register this agent in the score registry (one-time)."""
        c = self.ensure_contracts()
        return self._invoke(c["registry"], "register", [self._addr(self.public_key())])

    def borrow(self, usdc: float) -> TxResult:
        """Draw ``usdc`` against the credit line into this agent's wallet."""
        assert_positive_amount(usdc, "borrow amount")
        c = self.ensure_contracts()
        return self._invoke(
            c["vault"],
            "borrow",
            [self._addr(self.public_key()), self._i128(to_stroops(usdc))],
        )

    def repay(self, usdc: float) -> TxResult:
        """Repay ``usdc`` (interest first -> lender yield, then principal).

        Once this clears the balance it also settles the repayment into the
        agent's on-chain CREDIT HISTORY via the backend -- the vault itself
        never writes to score_registry, so without this an agent could repay
        perfectly forever and its credit ramp would never grow. Best-effort:
        a settlement failure is swallowed, since the repayment itself already
        succeeded on-chain and must not be reported as failed.
        """
        assert_positive_amount(usdc, "repay amount")
        c = self.ensure_contracts()
        result = self._invoke(
            c["vault"],
            "repay",
            [self._addr(self.public_key()), self._i128(to_stroops(usdc))],
        )
        try:
            self._api_post(f"/agent/{self.public_key()}/settle-repayment")
        except Exception:
            # credit-history settlement is best-effort -- the repay already landed
            pass
        return result

    def deposit(self, agent_address: str, usdc: float) -> TxResult:
        """Supply ``usdc`` of liquidity into ``agent_address``'s isolated vault.

        LP action -- the caller (this keypair) is the lender, exposed only to
        that one agent.
        """
        assert_valid_address(agent_address, "agent_address")
        assert_positive_amount(usdc, "deposit amount")
        c = self.ensure_contracts()
        return self._invoke(
            c["vault"],
            "deposit",
            [
                self._addr(self.public_key()),
                self._addr(agent_address),
                self._i128(to_stroops(usdc)),
            ],
        )

    # ---- internals ----

    @staticmethod
    def _addr(a: str) -> stellar_xdr.SCVal:
        return scval.to_address(a)

    @staticmethod
    def _i128(n: int) -> stellar_xdr.SCVal:
        return scval.to_int128(n)

    def _read(
        self,
        contract_id: str,
        method: str,
        args: List[stellar_xdr.SCVal],
    ) -> Any:
        source = self.server.load_account(self.public_key())
        tx = (
            TransactionBuilder(
                source, network_passphrase=self.passphrase, base_fee=BASE_FEE
            )
            .append_invoke_contract_function_op(contract_id, method, args)
            .set_timeout(30)
            .build()
        )
        sim = self.server.simulate_transaction(tx)
        if sim.error:
            raise TxError(f"{method} simulation failed: {sim.error}", method, sim.error)
        if not sim.results or not sim.results[0].xdr:
            return None
        return scval.to_native(sim.results[0].xdr)

    def _invoke(
        self,
        contract_id: str,
        method: str,
        args: List[stellar_xdr.SCVal],
    ) -> TxResult:
        source = self.server.load_account(self.public_key())
        tx = (
            TransactionBuilder(
                source, network_passphrase=self.passphrase, base_fee=BASE_FEE
            )
            .append_invoke_contract_function_op(contract_id, method, args)
            .set_timeout(300)
            .build()
        )
        prepared = self.server.prepare_transaction(tx)
        prepared.sign(self.keypair)
        sent = self.server.send_transaction(prepared)
        if sent.status == SendTransactionStatus.ERROR:
            raise TxError(f"{method} submit failed", method, sent.error_result_xdr)
        got = self.server.poll_transaction(sent.hash, max_attempts=40)
        if got.status != GetTransactionStatus.SUCCESS:
            raise TxError(f"{method} did not succeed: {got.status}", method, got)
        return TxResult(
            tx_hash=sent.hash,
            return_value=self._decode_return(got.result_meta_xdr),
            explorer_url=f"https://stellar.expert/explorer/testnet/tx/{sent.hash}",
        )

    @staticmethod
    def _decode_return(result_meta_xdr: Optional[str]) -> Any:
        if not result_meta_xdr:
            return None
        try:
            meta = stellar_xdr.TransactionMeta.from_xdr(result_meta_xdr)
            if meta.v3 and meta.v3.soroban_meta and meta.v3.soroban_meta.return_value:
                return scval.to_native(meta.v3.soroban_meta.return_value)
        except Exception:
            pass
        return None

    # ---- backend HTTP ----

    def _api_get(self, path: str) -> Any:
        res = self._session.get(f"{self.api_base_url}{path}")
        if not res.ok:
            raise ApiError(res.status_code, "GET", path, _safe_text(res))
        return res.json()

    def _api_post(self, path: str) -> Any:
        res = self._session.post(f"{self.api_base_url}{path}")
        if not res.ok:
            raise ApiError(res.status_code, "POST", path, _safe_text(res))
        return res.json()


def _safe_text(res: requests.Response) -> Optional[str]:
    try:
        return res.text
    except Exception:
        return None
