"""Adaptadores de proveedores de precios.

Cada fuente (tcgapi.dev, pokemontcg.io, eBay, PriceCharting) implementa
`PriceProvider`. La plataforma solo conoce la interfaz, nunca la fuente concreta.
"""

from tcg_core.providers.base import PriceProvider, ProviderError

__all__ = ["PriceProvider", "ProviderError"]
