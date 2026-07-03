"""Motor de análisis: convierte una serie de precios en un snapshot de métricas.

Puro (sin BD): toma la serie y devuelve un `Snapshot`. La persistencia vive en
repository.py. Degrada con elegancia: cada métrica es None si no hay datos
suficientes, y la señal solo se emite cuando hay base para calcularla.

La señal es INFORMATIVA, no es asesoramiento de inversión.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timedelta

import indicators as ind


@dataclass
class Snapshot:
    variant_id: str
    price_current: float | None
    currency: str
    change_24h: float | None
    change_7d: float | None
    change_30d: float | None
    change_90d: float | None
    sma_7: float | None
    sma_30: float | None
    sma_90: float | None
    volatility_30d: float | None
    rsi_14: float | None
    ath: float | None
    atl: float | None
    signal: str | None

    def as_dict(self) -> dict:
        return asdict(self)


def _pct_change_days(series: list[tuple[datetime, float]], days: int) -> float | None:
    """Variación % vs el precio de hace `days` días (punto más reciente <= corte)."""
    if len(series) < 2:
        return None
    last_ts, last_p = series[-1]
    cutoff = last_ts - timedelta(days=days)
    prev = None
    for ts, price in series:
        if ts <= cutoff:
            prev = price
    if prev is None or prev == 0:
        return None
    return (last_p - prev) / prev * 100.0


def _signal(
    price: float | None, sma30: float | None, rsi: float | None
) -> str | None:
    """Señal compuesta simple (buy/hold/sell). None si faltan datos base.

    Combina sobrecompra/sobreventa (RSI) con posición respecto a la media de 30.
    Informativa; no es asesoramiento financiero.
    """
    if price is None or sma30 is None or rsi is None:
        return None
    score = 0
    if rsi < 30:
        score += 1
    elif rsi > 70:
        score -= 1
    if price < sma30:
        score += 1
    elif price > sma30:
        score -= 1
    if score >= 1:
        return "buy"
    if score <= -1:
        return "sell"
    return "hold"


def compute_snapshot(
    variant_id: str,
    series: list[tuple[datetime, float]],
    currency: str = "USD",
) -> Snapshot:
    """Calcula todas las métricas de una variante a partir de su serie."""
    series = sorted(series, key=lambda x: x[0])
    values = [p for _, p in series]
    price_current = values[-1] if values else None

    sma30 = ind.sma(values, 30)
    rsi14 = ind.rsi(values, 14)

    return Snapshot(
        variant_id=variant_id,
        price_current=price_current,
        currency=currency,
        change_24h=_pct_change_days(series, 1),
        change_7d=_pct_change_days(series, 7),
        change_30d=_pct_change_days(series, 30),
        change_90d=_pct_change_days(series, 90),
        sma_7=ind.sma(values, 7),
        sma_30=sma30,
        sma_90=ind.sma(values, 90),
        volatility_30d=ind.volatility(values, 30),
        rsi_14=rsi14,
        ath=ind.high(values),
        atl=ind.low(values),
        signal=_signal(price_current, sma30, rsi14),
    )
