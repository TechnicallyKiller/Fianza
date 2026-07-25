"""Pure, side-effect-free helpers -- extracted so they can be unit-tested without
a network. This is where the "risky" logic lives (unit conversion, the
draw-on-402 shortfall math), which is exactly what needs coverage.

Mirrors ``packages/agent-sdk/src/util.ts`` (including its rounding semantics).
"""

from __future__ import annotations

import math
from typing import Optional, Union

from stellar_sdk import StrKey

from .errors import ValidationError, MaxDrawExceededError

STROOPS_PER_USDC = 10_000_000  # USDC on Stellar has 7 decimals


def _js_round(x: float) -> int:
    """Round half toward +Infinity, matching JavaScript ``Math.round``.

    Python's built-in ``round`` uses banker's rounding, which would diverge from
    the TypeScript SDK on half-stroop boundaries. ``floor(x + 0.5)`` reproduces
    ``Math.round`` exactly across the positive and negative domain.
    """
    return math.floor(x + 0.5)


def to_stroops(usdc: Union[int, float]) -> int:
    """USDC -> i128 stroops (7 decimals). Raises on non-finite input.

    ``int`` inputs are treated as whole USDC (like the number branch in TS), NOT
    as already-in-stroops. Pass a stroop count only if you have computed one.
    """
    if isinstance(usdc, bool) or not isinstance(usdc, (int, float)):
        raise ValidationError(f"amount must be a finite number, got {usdc!r}")
    if isinstance(usdc, float) and not math.isfinite(usdc):
        raise ValidationError(f"amount must be a finite number, got {usdc!r}")
    return _js_round(usdc * STROOPS_PER_USDC)


def from_stroops(stroops: Union[int, str, float]) -> float:
    """i128 stroops -> USDC. Accepts int, decimal string, or float."""
    return int(stroops) / STROOPS_PER_USDC


def assert_positive_amount(usdc: float, label: str = "amount") -> None:
    """Raise unless ``usdc`` is a finite number strictly greater than zero."""
    if isinstance(usdc, bool) or not isinstance(usdc, (int, float)):
        raise ValidationError(f"{label} must be a finite number, got {usdc!r}")
    if isinstance(usdc, float) and not math.isfinite(usdc):
        raise ValidationError(f"{label} must be a finite number, got {usdc!r}")
    if usdc <= 0:
        raise ValidationError(f"{label} must be greater than 0, got {usdc!r}")


def is_valid_stellar_address(address: str) -> bool:
    return isinstance(address, str) and StrKey.is_valid_ed25519_public_key(address)


def assert_valid_address(address: str, label: str = "address") -> None:
    if not is_valid_stellar_address(address):
        raise ValidationError(f"{label} is not a valid Stellar address: {address!r}")


def credit_shortfall_usdc(
    balance_usdc: float,
    price_usdc: float,
    max_draw: Optional[float] = None,
) -> float:
    """How much credit must be drawn to afford ``price_usdc`` given the current
    ``balance_usdc``.

    Returns 0 when the balance already covers the price; otherwise the shortfall
    rounded UP to the cent (so a draw is never a hair short of the price). Raises
    :class:`MaxDrawExceededError` when a ``max_draw`` cap is given and the
    shortfall exceeds it. This is the core of ``pay_with_credit``, isolated so
    it's testable without hitting the chain.
    """
    assert_positive_amount(price_usdc, "price_usdc")
    if (
        isinstance(balance_usdc, bool)
        or not isinstance(balance_usdc, (int, float))
        or (isinstance(balance_usdc, float) and not math.isfinite(balance_usdc))
        or balance_usdc < 0
    ):
        raise ValidationError(
            f"balance_usdc must be a finite, non-negative number, got {balance_usdc!r}"
        )
    if balance_usdc >= price_usdc:
        return 0
    need = math.ceil((price_usdc - balance_usdc) * 100) / 100
    if max_draw is not None and need > max_draw:
        raise MaxDrawExceededError(need, max_draw)
    return need
