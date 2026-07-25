"""Typed error hierarchy so callers can catch specific failures instead of
string-matching generic exceptions. All extend :class:`FianzaError`, so
``except FianzaError`` covers everything the SDK raises.

Mirrors ``packages/agent-sdk/src/errors.ts``.
"""

from __future__ import annotations

from typing import Any, Optional


class FianzaError(Exception):
    """Base class for every error the Fianza SDK raises."""


class ValidationError(FianzaError):
    """Bad input passed to the SDK (invalid amount, malformed address, etc.)."""


class ApiError(FianzaError):
    """A call to the Fianza backend API returned a non-2xx status."""

    def __init__(
        self,
        status: int,
        method: str,
        path: str,
        body: Optional[Any] = None,
    ) -> None:
        super().__init__(f"{method} {path} -> {status}")
        self.status = status
        self.method = method
        self.path = path
        self.body = body


class TxError(FianzaError):
    """An on-chain transaction failed to simulate, submit, or confirm."""

    def __init__(
        self,
        message: str,
        contract_method: str,
        detail: Optional[Any] = None,
    ) -> None:
        super().__init__(message)
        self.contract_method = contract_method
        self.detail = detail


class MaxDrawExceededError(FianzaError):
    """``pay_with_credit`` would have to draw more than the caller's ``max_draw`` cap."""

    def __init__(self, need: float, max_draw: float) -> None:
        super().__init__(
            f"x402 shortfall {need} USDC exceeds max_draw {max_draw} USDC"
        )
        self.need = need
        self.max_draw = max_draw
