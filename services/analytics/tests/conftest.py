"""Pone el directorio del servicio de análisis en sys.path para los tests."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
