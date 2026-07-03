"""Tests de los indicadores puros (valores deterministas)."""

from __future__ import annotations

import indicators as ind


def test_sma_basic():
    assert ind.sma([1, 2, 3, 4], 2) == 3.5   # media de [3,4]
    assert ind.sma([1, 2, 3], 4) is None      # datos insuficientes


def test_ema_defined_and_none():
    assert ind.ema([1, 2, 3], 5) is None
    val = ind.ema([1, 2, 3, 4, 5], 3)
    assert val is not None and val > 0


def test_rsi_monotonic():
    assert ind.rsi(list(range(1, 20)), 14) == 100.0        # solo subidas
    assert ind.rsi(list(range(20, 1, -1)), 14) == 0.0      # solo bajadas
    assert ind.rsi([1, 2, 3], 14) is None                  # insuficiente


def test_rsi_midrange():
    # serie oscilante -> RSI intermedio
    values = [10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11]
    r = ind.rsi(values, 14)
    assert r is not None and 0 < r < 100


def test_volatility():
    assert ind.volatility([100, 100, 100, 100], 30) == 0.0  # sin cambios -> 0
    assert ind.volatility([100], 30) is None                # insuficiente
    assert ind.volatility([100, 110, 90, 120], 30) > 0


def test_high_low():
    assert ind.high([3, 1, 4, 1, 5]) == 5
    assert ind.low([3, 1, 4, 1, 5]) == 1
    assert ind.high([]) is None
