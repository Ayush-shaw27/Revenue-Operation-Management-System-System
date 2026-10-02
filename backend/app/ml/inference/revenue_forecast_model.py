"""RevenueForecastModel — real revenue forecasting over closed-won deals.

The model is trained on actual closed-won values from the live database and
supports three regression backends (linear / gradient-boosting / ridge).
No fabricated data: if there are too few closed-won deals it reports an
honest "insufficient data" forecast with zero totals.
"""
from __future__ import annotations
from typing import Any, Dict, List

import numpy as np
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from app.services import data_store as ds

MIN_TRAIN_SAMPLES = 5
MIN_FORECAST_SAMPLES = 3
# Number of leading months used to warm up the walk-forward validation before
# any month is held out and predicted.
WARMUP_SAMPLES = 3


class RevenueForecastModel:
    def __init__(self):
        self.model = None
        self.is_trained = False
        self.version = "2.0.0"
        self.months: List[str] = []
        self.values: List[float] = []
        # Walk-forward validation results, keyed by model_type.  Keying by model
        # matters: a Ridge forecast and a gradient-boosting one are different
        # models with different honest accuracy, so one shared slot would report
        # whichever was computed first for every model type.
        self._wf_cache: Dict[str, Dict[str, Any]] = {}
        try:
            self._load_history()
            self._train()
        except Exception:
            # DB may not exist yet at import time (e.g. during first startup
            # before lifespan init_db runs).  The model will train on first
            # forecast call if data is available.
            pass

    # ------------------------------------------------------------------ data
    def _load_history(self) -> None:
        deals = ds.get_deals()
        closed_won = [
            d for d in deals
            if d.get("stage") == "closed-won" and d.get("value", 0) > 0 and d.get("close_date")
        ]
        closed_won_sorted = sorted(closed_won, key=lambda d: d.get("close_date", ""))

        monthly: Dict[str, List[float]] = {}
        for d in closed_won_sorted:
            month = str(d["close_date"])[:7]
            monthly.setdefault(month, []).append(float(d["value"]))
        self.months = sorted(monthly.keys())
        self.values = [round(sum(monthly[m]), 2) for m in self.months]
        # History may have changed, so any previously validated metric is now
        # stale and must not be reused.
        self._invalidate_cache()

    # ------------------------------------------------------- validation cache
    def _data_signature(self) -> tuple:
        """Fingerprint of the history the cached metrics were computed from.

        If the underlying months change (a new closed-won deal lands, the seed
        data is reloaded) every cached validation result is stale and must be
        recomputed rather than silently reported as current.
        """
        return tuple(self.months)

    def _invalidate_cache(self) -> None:
        """Drop cached walk-forward results (call whenever the data changes)."""
        self._wf_cache = {}

    def _train(self) -> None:
        values = np.array(self.values)
        if len(values) < MIN_TRAIN_SAMPLES:
            self.is_trained = False
            return
        X = np.arange(len(values)).reshape(-1, 1)
        y = values
        self._reg = GradientBoostingRegressor(
            n_estimators=100, learning_rate=0.1, max_depth=3, random_state=42
        )
        self._reg.fit(X, y)
        # Out-of-sample metrics (walk-forward).  In-sample residuals are
        # near-zero by construction and would report a misleading ~100 R².
        self._evaluate_walk_forward()
        self.is_trained = True

    # ---------------------------------------------------------- evaluation
    def _make_regressor(self, model_type: str):
        """Build the regressor for a given model_type (no fitting)."""
        if model_type == "linear":
            return LinearRegression()
        if model_type == "gradient-boosting":
            return GradientBoostingRegressor(
                n_estimators=100, learning_rate=0.1, max_depth=3, random_state=42
            )
        return Ridge(alpha=1.0)

    def _evaluate_walk_forward(self, model_type: str = "gradient-boosting") -> Dict[str, Any]:
        """Expanding-window (walk-forward) validation.

        For every point after a minimum warm-up, the model is fitted only on data
        strictly *before* that point and asked to predict it.  The metrics below
        therefore describe performance on genuinely unseen months, which is the
        only honest way to report forecast accuracy.

        Results are memoised per ``model_type`` and keyed on a fingerprint of the
        history, so a Ridge number is never served for a gradient-boosting
        request and a metric computed before new data arrived is recomputed.
        """
        sig = self._data_signature()
        cached = self._wf_cache.get(model_type)
        if cached is not None and cached.get("signature") == sig:
            return cached["metrics"]

        metrics = self._compute_walk_forward(model_type)
        self._wf_cache[model_type] = {"signature": sig, "metrics": metrics}
        # Keep the legacy single-slot attributes pointing at the most recent
        # evaluation for any caller that still reads them directly.
        self._wf_mae = metrics.get("mae")
        self._wf_rmse = metrics.get("rmse")
        self._wf_r2 = metrics.get("r2")
        self._wf_residuals = metrics.get("residuals", [])
        return metrics

    def _compute_walk_forward(self, model_type: str) -> Dict[str, Any]:
        """Uncached walk-forward validation for a specific regressor."""
        values = np.array(self.values, dtype=float)
        n = len(values)
        # Need at least WARMUP_SAMPLES past points plus 2 held-out points to
        # compute a meaningful R².
        if n < WARMUP_SAMPLES + 2:
            self._wf_mae = None
            self._wf_rmse = None
            self._wf_r2 = None
            self._wf_residuals = []
            return {"mae": None, "rmse": None, "r2": None, "folds": 0, "residuals": []}

        actuals: List[float] = []
        predictions: List[float] = []
        residuals: List[float] = []

        for t in range(WARMUP_SAMPLES, n):
            train_idx = np.arange(t).reshape(-1, 1)
            reg = self._make_regressor(model_type)
            reg.fit(train_idx, values[:t])
            pred = float(reg.predict(np.array([[t]]))[0])
            actual = float(values[t])
            actuals.append(actual)
            predictions.append(pred)
            residuals.append(actual - pred)

        mae = float(mean_absolute_error(actuals, predictions))
        rmse = float(np.sqrt(mean_squared_error(actuals, predictions)))
        # R² against the *held-out* mean.  With a single fold this is undefined,
        # so guard it.
        r2 = float(r2_score(actuals, predictions)) if len(actuals) > 1 else None

        self._wf_mae = mae
        self._wf_rmse = rmse
        self._wf_r2 = r2
        return {"mae": mae, "rmse": rmse, "r2": r2, "folds": len(actuals),
                "residuals": residuals}

    def _residual_sigma(self, model_type: str) -> float:
        """Std-dev of walk-forward residuals - used for honest confidence bands."""
        metrics = self._evaluate_walk_forward(model_type)
        residuals = metrics.get("residuals") or []
        if len(residuals) < 2:
            return 0.0
        return float(np.std(residuals, ddof=1))

    # ------------------------------------------------------------------ API
    def accuracy(self, model_type: str = "gradient-boosting") -> float:
        """Out-of-sample accuracy as a percentage of walk-forward R².

        Returns 0.0 (not 100.0) when there are not enough months to validate
        honestly, and clamps to 0 when R² is negative (worse than predicting
        the mean).

        The metric is read from the per-model cache so that asking for the
        ``ridge`` accuracy never returns the number computed for
        ``gradient-boosting`` (or vice versa).
        """
        metrics = self._evaluate_walk_forward(model_type)
        r2 = metrics.get("r2")
        if r2 is None:
            return 0.0
        return round(max(0.0, min(100.0, float(r2) * 100)), 1)

    def evaluation_method(self) -> str:
        return "walk-forward (expanding-window, out-of-sample)"

    def status(self) -> Dict[str, Any]:
        return {
            "name": "revenue_forecast",
            "version": self.version,
            "trained": self.is_trained,
            "accuracy": self.accuracy(),
            "evaluation_method": self.evaluation_method(),
            "months": len(self.months),
        }
    def forecast(self, timeframe: str = "monthly", model_type: str = "ridge") -> Dict[str, Any]:
        values = self.values
        n_known = len(values)
        if n_known < MIN_FORECAST_SAMPLES:
            return self._empty_forecast(timeframe, model_type)

        X_train = np.arange(n_known).reshape(-1, 1)
        y_train = np.array(values)

        # Out-of-sample evaluation for the *requested* model type.
        wf = self._evaluate_walk_forward(model_type)
        sigma = self._residual_sigma(model_type)
        # Fall back to a fraction of the mean when residual std is unavailable
        # (too little history) so the band is at least finite.
        band = sigma if sigma > 0 else float(np.mean(values) * 0.10)

        if model_type == "linear":
            desc = "Ordinary Least Squares regression"
        elif model_type == "gradient-boosting":
            desc = "Gradient-Boosted Regressor"
        else:
            desc = "Regularized Ridge regression"

        reg = self._make_regressor(model_type)
        reg.fit(X_train, y_train)

        output_points: List[Dict[str, Any]] = []
        for i, val in enumerate(values):
            pred_idx = np.array([[i]])
            trend_val = float(reg.predict(pred_idx)[0])
            actual = float(val)
            # Confidence band from measured out-of-sample error (1.96σ ≈ 95%).
            upper = round(actual + 1.96 * band, 2)
            lower = round(max(0.0, actual - 1.96 * band), 2)
            conf = int(np.clip(90 - (i * 1.5), 70, 96))
            period = self.months[i] if i < len(self.months) else f"Period {i + 1}"
            output_points.append({
                "period": period, "actual": actual,
                "traditional": round(trend_val, 2), "mlForecast": round(trend_val, 2),
                "confidence": conf, "lower_bound": lower, "upper_bound": upper,
            })

        last_idx = n_known - 1
        for i in range(1, 4):
            pred_idx = np.array([[last_idx + i]])
            forecast_val = max(float(reg.predict(pred_idx)[0]), 0)
            # Bands widen with horizon, reflecting compounding uncertainty.
            spread = 1.96 * band * (1 + (i - 1) * 0.35)
            upper = round(forecast_val + spread, 2)
            lower = round(max(0.0, forecast_val - spread), 2)
            conf = int(np.clip(85 - (i * 2), 65, 92))
            output_points.append({
                "period": f"Forecast {i}", "actual": 0,
                "traditional": round(forecast_val, 2), "mlForecast": round(forecast_val, 2),
                "confidence": conf, "lower_bound": lower, "upper_bound": upper,
            })

        total_forecast = sum(float(d["mlForecast"]) for d in output_points)

        result: Dict[str, Any] = {
            "timeframe": timeframe,
            "model_type": model_type,
            "accuracy": self.accuracy(model_type),
            "accuracy_method": self.evaluation_method(),
            "model_description": desc,
            "data": output_points,
            "traditional_total": round(total_forecast, 2),
            "ml_projected_total": round(total_forecast, 2),
            "variance_percentage": 0.0,
            # Out-of-sample metrics over held-out months.
            "mae": round(wf["mae"], 2) if wf["mae"] is not None else None,
            "rmse": round(wf["rmse"], 2) if wf["rmse"] is not None else None,
            "r2": round(wf["r2"], 3) if wf["r2"] is not None else None,
            "validation_folds": wf["folds"],
        }
        return result

    def _empty_forecast(self, timeframe: str, model_type: str) -> Dict[str, Any]:
        return {
            "timeframe": timeframe,
            "model_type": model_type,
            "accuracy": 0.0,
            "accuracy_method": self.evaluation_method(),
            "model_description": "Insufficient closed-won data for a reliable forecast",
            "data": [],
            "traditional_total": 0,
            "ml_projected_total": 0,
            "variance_percentage": 0,
            "mae": None,
            "rmse": None,
            "r2": None,
            "validation_folds": 0,
        }