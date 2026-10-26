# breakpoint-ledger-demo

Trusted pytest sample: a real order-dependent failure.

```
python3 -m pytest tests/test_ledger_flow.py     # fails (order dependence)
python3 -m pytest tests/test_ledger_flow.py::test_expected_total   # passes alone
```

`test_charge_is_recorded` leaves a charge in `billing._ledger`; the second
test asserts a total that assumes a fresh ledger. Breakpoint triages the
file, resolves `test_expected_total` as the failing target with
`test_charge_is_recorded` as its predecessor, proves the conflict across the
run matrix, and drafts the cleanup patch: wire the existing `reset_ledger()`
into an autouse fixture.
