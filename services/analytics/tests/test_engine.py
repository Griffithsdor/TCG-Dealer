"""Tests del motor con series sintéticas (prueba que funciona aunque el histórico
real sea corto todavía)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from engine import compute_snapshot


def _series(prices: list[float]) -> list[tuple[datetime, float]]:
    """Serie diaria terminando hoy."""
    today = datetime(2026, 7, 2, tzinfo=timezone.utc)
    n = len(prices)
    return [(today - timedelta(days=n - 1 - i), p) for i, p in enumerate(prices)]


def test_rising_series_full_metrics():
    # 60 días subiendo de 100 a 159
    snap = compute_snapshot("v1", _series([100 + i for i in range(60)]))
    assert snap.price_current == 159
    assert snap.change_30d is not None and snap.change_30d > 0
    assert snap.sma_7 is not None and snap.sma_30 is not None and snap.sma_90 is None
    assert snap.rsi_14 == 100.0          # solo subidas
    assert snap.ath == 159 and snap.atl == 100
    assert snap.signal in {"buy", "hold", "sell"}


def test_insufficient_data_degrades():
    # un solo punto: casi todo None, no revienta
    snap = compute_snapshot("v1", _series([42.0]))
    assert snap.price_current == 42.0
    assert snap.change_7d is None
    assert snap.sma_7 is None
    assert snap.rsi_14 is None
    assert snap.signal is None           # sin base -> sin señal
    assert snap.ath == 42.0 and snap.atl == 42.0


def test_empty_series():
    snap = compute_snapshot("v1", [])
    assert snap.price_current is None
    assert snap.signal is None


def test_change_7d_computed():
    # precio sube 10% respecto a hace 7 días
    prices = [100.0] * 8 + [110.0]   # el último es hoy; hace 7 días valía 100
    snap = compute_snapshot("v1", _series(prices))
    assert snap.change_7d is not None
    assert round(snap.change_7d, 1) == 10.0


def test_oversold_below_mean_signals_buy():
    # caída fuerte y sostenida -> RSI bajo + precio bajo la media -> buy
    prices = [100 - i for i in range(40)]  # baja de 100 a 61
    snap = compute_snapshot("v1", _series(prices))
    assert snap.rsi_14 == 0.0
    assert snap.price_current < snap.sma_30
    assert snap.signal == "buy"
