"""Indicadores técnicos puros (sin numpy/pandas → Lambda ligera).

Todas las funciones operan sobre una lista de precios en orden cronológico
(ascendente por fecha) y DEGRADAN CON ELEGANCIA: si no hay suficientes puntos
para la ventana pedida, devuelven None en vez de fallar. Así el motor funciona
desde el día 1 y se enriquece conforme se acumula la serie.
"""

from __future__ import annotations

from statistics import fmean, pstdev


def sma(values: list[float], window: int) -> float | None:
    """Media móvil simple de los últimos `window` puntos."""
    if window <= 0 or len(values) < window:
        return None
    return fmean(values[-window:])


def ema(values: list[float], window: int) -> float | None:
    """Media móvil exponencial. Se siembra con la SMA de los primeros `window`."""
    if window <= 0 or len(values) < window:
        return None
    k = 2.0 / (window + 1)
    e = fmean(values[:window])
    for v in values[window:]:
        e = v * k + e * (1 - k)
    return e


def returns(values: list[float]) -> list[float]:
    """Retornos simples punto a punto (ignora divisiones por cero)."""
    out: list[float] = []
    for a, b in zip(values, values[1:]):
        if a:
            out.append((b - a) / a)
    return out


def volatility(values: list[float], window: int = 30) -> float | None:
    """Volatilidad = desviación estándar de los retornos (en %), sobre `window`."""
    sample = values[-(window + 1):] if len(values) > window + 1 else values
    r = returns(sample)
    if len(r) < 2:
        return None
    return pstdev(r) * 100.0


def rsi(values: list[float], period: int = 14) -> float | None:
    """Índice de fuerza relativa (RSI) clásico sobre `period` cambios."""
    if len(values) < period + 1:
        return None
    window = values[-(period + 1):]
    gains, losses = [], []
    for a, b in zip(window, window[1:]):
        change = b - a
        gains.append(max(change, 0.0))
        losses.append(max(-change, 0.0))
    avg_gain = fmean(gains)
    avg_loss = fmean(losses)
    if avg_loss == 0:
        return 100.0 if avg_gain > 0 else 50.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))


def high(values: list[float]) -> float | None:
    return max(values) if values else None


def low(values: list[float]) -> float | None:
    return min(values) if values else None
