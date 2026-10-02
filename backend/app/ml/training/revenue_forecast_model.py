"""RevenueForecastModel training entry point.

The canonical implementation lives under app.ml.inference.revenue_forecast_model;
this module re-exports it so ``from app.ml.training.revenue_forecast_model import
RevenueForecastModel`` works for training tooling.
"""
from app.ml.inference.revenue_forecast_model import RevenueForecastModel

__all__ = ["RevenueForecastModel"]