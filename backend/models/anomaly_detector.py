"""backend/models/anomaly_detector.py
Pipeline anomaly detection (P1).

Uses IsolationForest over deal feature vectors (days_in_stage, value,
probability, probability delta). Also applies a staleness heuristic to flag
deals that have not progressed beyond their expected stage dwell time.
"""
import os
from typing import Dict, Any, List, Optional

import numpy as np
import joblib
from sklearn.ensemble import IsolationForest

ANOMALY_MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "anomaly_detector.joblib")
ANOMALY_MODEL_PATH = os.path.abspath(ANOMALY_MODEL_PATH)

# Maximum days expected in each stage before a deal is considered "stalled"
STAGE_THRESHOLDS = {
    "prospecting": 10,
    "qualification": 14,
    "proposal": 14,
    "negotiation": 21,
    "closed-won": 30,
    "closed-lost": 30,
}


class DealAnomalyDetector:
    def __init__(self):
        self.model: Optional[IsolationForest] = None
        self.is_trained = False
        self.version = "1.0.0"
        self._load_or_train()

    def _feature_matrix(self, deals: List[Dict[str, Any]]) -> np.ndarray:
        """Build a numeric feature matrix from deal dicts."""
        rows = []
        for d in deals:
            days = d.get("days_in_stage", 0)
            value = d.get("value", 0)
            prob = d.get("probability", 50)
            stage = d.get("stage", "qualification")
            threshold = STAGE_THRESHOLDS.get(stage, 14)
            staleness = max(days - threshold, 0)
            rows.append([
                float(days),
                float(value),
                float(prob),
                float(staleness),
            ])
        return np.array(rows, dtype=float)

    def _train(self, n_synthetic: int = 600):
        np.random.seed(42)
        # Synthetic deals mixing normal and anomalous patterns
        n_normal = int(n_synthetic * 0.8)
        n_anom = n_synthetic - n_normal
        normal = np.column_stack([
            np.clip(np.random.normal(10, 5, n_normal), 1, 40),
            np.random.exponential(scale=100000, size=n_normal),
            np.clip(np.random.normal(55, 20, n_normal), 10, 95),
            np.clip(np.random.normal(5, 4, n_normal), 0, 30),
        ])
        anomalous = np.column_stack([
            np.clip(np.random.normal(35, 12, n_anom), 10, 120),
            np.random.exponential(scale=180000, size=n_anom),
            np.clip(np.random.normal(40, 25, n_anom), 5, 100),
            np.clip(np.random.normal(28, 10, n_anom), 5, 80),
        ])
        X = np.vstack([normal, anomalous])
        self.model = IsolationForest(
            n_estimators=120, contamination=0.18, max_features=1.0, random_state=42
        )
        self.model.fit(X)
        self.is_trained = True
        self._save()

    def _load(self):
        self.model = joblib.load(ANOMALY_MODEL_PATH)
        self.is_trained = True

    def _load_or_train(self):
        try:
            if os.path.exists(ANOMALY_MODEL_PATH):
                self._load()
                return
        except Exception:
            pass
        self._train()

    def _save(self):
        try:
            joblib.dump(self.model, ANOMALY_MODEL_PATH)
        except Exception:
            pass

    def retrain(self) -> Dict[str, Any]:
        self._train()
        return self.status()

    def status(self) -> Dict[str, Any]:
        return {"name": "anomaly_detector", "version": self.version, "trained": self.is_trained}

    # ------------------------------------------------------------------ inference
    def detect(self, deals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Score every deal.  Returns a parallel list of detection dicts."""
        results: List[Dict[str, Any]] = []
        for deal in deals:
            days = deal.get("days_in_stage", 0)
            stage = deal.get("stage", "qualification")
            threshold = STAGE_THRESHOLDS.get(stage, 14)
            stalled = days > threshold
            # One-row feature matrix for a single sample
            X = self._feature_matrix([deal])
            anomaly_score = float(self.model.decision_function(X)[0]) if self.model is not None else 0.0
            is_anomalous = bool(self.model.predict(X)[0] == -1) if self.model is not None else False
            reasons: List[str] = []
            if stalled:
                reasons.append(f"Stalled in {stage} for {days} days (>{threshold} threshold)")
            if is_anomalous:
                reasons.append("IsolationForest outlier on deal feature vector")
            if not reasons and deal.get("probability", 50) > 80 and days > threshold:
                reasons.append("High-probability deal not advancing despite readiness")
            results.append({
                "deal_id": deal["id"],
                "deal_title": deal.get("title", ""),
                "company": deal.get("company", ""),
                "value": deal.get("value", 0),
                "stage": stage,
                "days_in_stage": days,
                "anomaly_score": round(anomaly_score, 3),
                "is_anomalous": is_anomalous or stalled,
                "stalled": stalled,
                "reasons": reasons,
                "model_version": self.version,
            })
        return results
