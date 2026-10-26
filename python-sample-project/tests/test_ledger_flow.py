"""Order-dependent billing tests.

Running the whole file in declared order fails: the first test's charge
survives into the second test's total. Each test passes alone.
"""

from billing import record_charge, total_charged


def test_charge_is_recorded():
    record_charge(5)
    assert total_charged() == 5


def test_expected_total():
    record_charge(7)
    assert total_charged() == 7
