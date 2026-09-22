import numpy as np
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from typing import Dict, Any, List, Optional

from backend import data_store as ds


class RevenueForecastModel:
    def __init__(self):
        self.model = None
        self.is_trained = False
        self._train()

    def _train(self):
        deals = ds.get_deals()
        closed_won = [d for d in deals if d.get("stage") == "closed-won" and d.get("value", 0) > 0]
        if len(closed_won) < 5:
            self.is_trained = False
            return

        closed_won_sorted = sorted(closed_won, key=lambda d: d.get("created_at", ""))
        values = [d["value"] for d in closed_won_sorted]
        X = np.arange(len(values)).reshape(-1, 1)
        y = np.array(values)

        self.model = GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=3, random_state=42)
        self.model.fit(X, y)
        preds = self.model.predict(X)
        self._mae = float(mean_absolute_error(y, preds))
        self._rmse = float(np.sqrt(mean_squared_error(y, preds)))
        self._r2 = float(r2_score(y, preds))
        self.is_trained = True

    def forecast(self, timeframe: str = "monthly", model_type: str = "ridge") -> Dict[str, Any]:
        deals = ds.get_deals()
        closed_won = [d for d in deals if d.get("stage") == "closed-won" and d.get("value", 0) > 0]
        closed_won_sorted = sorted(closed_won, key=lambda d: d.get("created_at", ""))

        if len(closed_won_sorted) < 3:
            return self._empty_forecast(timeframe, model_type)

        values = [d["value"] for d in closed_won_sorted]
        n_known = len(values)
        X_train = np.arange(n_known).reshape(-1, 1)
        y_train = np.array(values)

        if model_type == "linear":
            reg = LinearRegression()
            reg.fit(X_train, y_train)
            desc = "Ordinary Least Squares regression"
            noise_factor = 0.05
        elif model_type == "gradient-boosting":
            reg = GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=3, random_state=42)
            reg.fit(X_train, y_train)
            desc = "Gradient-Boosted Regressor"
            noise_factor = 0.03
        else:
            reg = Ridge(alpha=1.0)
            reg.fit(X_train, y_train)
            desc = "Regularized Ridge regression"
            noise_factor = 0.04

        known_mae = None
        if n_known >= 3:
            train_preds = reg.predict(X_train)
            known_mae = float(mean_absolute_error(y_train, train_preds))

        output_points = []
        for i, val in enumerate(values):
            pred_idx = np.array([[i]])
            trend_val = float(reg.predict(pred_idx)[0])
            actual = float(val)
            upper = round(actual * (1.0 + noise_factor * 2.5), 2)
            lower = round(actual * (1.0 - noise_factor * 2.5), 2)
            conf = int(np.clip(90 - (i * 1.5), 70, 96))
            output_points.append({
                "period": f"Period {i+1}",
                "actual": actual,
                "traditional": round(trend_val, 2),
                "mlForecast": round(trend_val, 2),
                "confidence": conf,
                "lower_bound": lower,
                "upper_bound": upper,
            })

        last_idx = n_known - 1
        for i in range(1, 4):
            pred_idx = np.array([[last_idx + i]])
            forecast_val = float(reg.predict(pred_idx)[0])
            forecast_val = max(forecast_val, 0)
            upper = round(forecast_val * (1.0 + noise_factor * 2.5), 2)
            lower = round(max(0, forecast_val * (1.0 - noise_factor * 2.5)), 2)
            conf = int(np.clip(85 - (i * 2), 65, 92))
            output_points.append({
                "period": f"Forecast {i}",
                "actual": 0,
                "traditional": round(forecast_val, 2),
                "mlForecast": round(forecast_val, 2),
                "confidence": conf,
                "lower_bound": lower,
                "upper_bound": upper,
            })

        total_actual = sum(float(d["actual"]) for d in output_points if d["actual"] > 0)
        total_forecast = sum(float(d["mlForecast"]) for d in output_points)

        result = {
            "timeframe": timeframe,
            "model_type": model_type,
            "accuracy": round(float(self._r2 * 100), 1) if hasattr(self, '_r2') else 0.0,
            "model_description": desc,
            "data": output_points,
            "traditional_total": round(total_forecast, 2),
            "ml_projected_total": round(total_forecast, 2),
            "variance_percentage": 0.0,
        }
        if known_mae is not None:
            result["mae"] = round(known_mae, 2)
            result["rmse"] = round(float(np.sqrt(mean_squared_error(y_train, reg.predict(X_train)))), 2)
            result["r2"] = round(float(r2_score(y_train, reg.predict(X_train))), 3)
        return result

    def _empty_forecast(self, timeframe: str, model_type: str) -> Dict[str, Any]:
        return {
            "timeframe": timeframe,
            "model_type": model_type,
            "accuracy": 0.0,
            "model_description": "Insufficient data for training",
            "data": [],
            "traditional_total": 0,
            "ml_projected_total": 0,
            "variance_percentage": 0,
            "mae": None,
            "rmse": None,
            "r2": None,
        }