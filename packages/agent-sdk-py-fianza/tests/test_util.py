"""Pure-logic tests, mirroring packages/agent-sdk/test/util.test.ts."""

import pytest
from stellar_sdk import Keypair

from fianza.util import (
    to_stroops,
    from_stroops,
    assert_positive_amount,
    is_valid_stellar_address,
    assert_valid_address,
    credit_shortfall_usdc,
)
from fianza.errors import ValidationError, MaxDrawExceededError


def test_to_stroops_usdc_to_stroops():
    assert to_stroops(1) == 10_000_000
    assert to_stroops(0.3) == 3_000_000
    assert to_stroops(0.1455882) == 1_455_882


def test_to_stroops_no_float_drift():
    # 0.1 + 0.2 = 0.30000000000000004 in float; must still land on 3_000_000.
    assert to_stroops(0.1 + 0.2) == 3_000_000


def test_to_stroops_rejects_non_finite():
    assert to_stroops(5) == 50_000_000  # int whole-USDC branch
    with pytest.raises(ValidationError):
        to_stroops(float("nan"))
    with pytest.raises(ValidationError):
        to_stroops(float("inf"))
    with pytest.raises(ValidationError):
        to_stroops("1")  # type: ignore[arg-type]


def test_from_stroops():
    assert from_stroops(10_000_000) == 1
    assert from_stroops("1455882") == 0.1455882
    assert from_stroops(3_000_000) == 0.3


def test_round_trip_stable():
    for v in (0.05, 0.3, 1.5, 2.3529411):
        assert from_stroops(to_stroops(v)) == v


def test_assert_positive_amount():
    assert_positive_amount(0.01)
    with pytest.raises(ValidationError):
        assert_positive_amount(0)
    with pytest.raises(ValidationError):
        assert_positive_amount(-1)
    with pytest.raises(ValidationError):
        assert_positive_amount(float("nan"))
    with pytest.raises(ValidationError):
        assert_positive_amount("1")  # type: ignore[arg-type]


def test_address_validation():
    good = Keypair.random().public_key
    assert is_valid_stellar_address(good) is True
    assert is_valid_stellar_address("not-an-address") is False
    assert is_valid_stellar_address("") is False
    assert_valid_address(good)
    with pytest.raises(ValidationError):
        assert_valid_address("nope", "agent_address")


def test_credit_shortfall_covered():
    assert credit_shortfall_usdc(1, 0.3) == 0
    assert credit_shortfall_usdc(0.3, 0.3) == 0  # exactly enough


def test_credit_shortfall_rounds_up_to_cent():
    assert credit_shortfall_usdc(0, 0.3) == 0.3
    assert credit_shortfall_usdc(0.1, 0.3) == 0.2
    # 0.234 shortfall must round up to 0.24 so the draw is never short.
    assert credit_shortfall_usdc(0.066, 0.3) == 0.24


def test_credit_shortfall_max_draw():
    credit_shortfall_usdc(0, 0.3, 0.5)  # ok
    with pytest.raises(MaxDrawExceededError):
        credit_shortfall_usdc(0, 0.3, 0.1)
    with pytest.raises(MaxDrawExceededError) as exc:
        credit_shortfall_usdc(0, 0.3, 0.1)
    assert exc.value.need == 0.3
    assert exc.value.max_draw == 0.1


def test_credit_shortfall_rejects_invalid():
    with pytest.raises(ValidationError):
        credit_shortfall_usdc(1, 0)  # price <= 0
    with pytest.raises(ValidationError):
        credit_shortfall_usdc(-1, 0.3)  # negative balance
    with pytest.raises(ValidationError):
        credit_shortfall_usdc(float("nan"), 0.3)
