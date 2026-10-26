"""Billing ledger with module-level state.

`_ledger` survives between test functions in the same process, so the
"expected total" test only passes when it runs first. Breakpoint's static
analysis should flag `_ledger`, the exported mutators, and the missing
reset hook — and the cleanup patch wires `reset_ledger()` into an autouse
fixture.
"""

_ledger: list[float] = []


def record_charge(amount: float) -> int:
    """Records a charge and returns the number of charges so far."""
    _ledger.append(float(amount))
    return len(_ledger)


def total_charged() -> float:
    """Sum of every recorded charge."""
    return sum(_ledger)


def reset_ledger() -> None:
    """Clears the ledger back to its declared initial state."""
    _ledger.clear()
