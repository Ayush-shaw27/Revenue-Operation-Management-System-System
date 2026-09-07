"""
backend/retrain_model.py
Script to retrain the lead scoring model, churn model, and anomaly detector.
Run this periodically or when new data is available.
"""
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from typing import Dict, Any
import os

MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lead_scoring_model.joblib")


def generate_training_data(n_samples: int = 1000) -> pd.DataFrame:
    np.random.seed(42)
    sources = ["Website", "LinkedIn", "Referral", "Email Campaign", "Cold Outreach", "Event"]
    industries = ["Technology", "Healthcare", "Finance", "Retail", "Manufacturing"]

    data = {
        "value": np.random.exponential(scale=45000, size=n_samples) + 5000,
        "source": np.random.choice(sources, size=n_samples, p=[0.25, 0.25, 0.2, 0.15, 0.1, 0.05]),
        "touchpoints": np.random.poisson(lam=4, size=n_samples) + 1,
        "industry": np.random.choice(industries, size=n_samples),
        "company_size": np.random.choice(["Startup", "Mid-Market", "Enterprise"], size=n_samples, p=[0.3, 0.45, 0.25]),
    }

    df = pd.DataFrame(data)

    source_weights = {"Referral": 0.4, "Website": 0.25, "LinkedIn": 0.2, "Email Campaign": 0.1, "Event": 0.3, "Cold Outreach": -0.1}
    size_weights = {"Enterprise": 0.35, "Mid-Market": 0.2, "Startup": 0.05}

    logits = (
        (df["value"] / 100000) * 0.4 +
        (df["touchpoints"] / 10) * 0.6 +
        df["source"].map(source_weights) +
        df["company_size"].map(size_weights) +
        np.random.normal(0, 0.2, size=n_samples)
    )

    prob = 1 / (1 + np.exp(-logits))
    y = (prob > 0.55).astype(int)

    categorical_features = ["source", "industry", "company_size"]
    numerical_features = ["value", "touchpoints"]

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", "passthrough", numerical_features),
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_features),
        ]
    )

    pipeline = Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("classifier", RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42))
    ])

    pipeline.fit(df, y)
    return pipeline


def retrain_lead_model() -> float:
    """Retrain lead scoring model and return accuracy."""
    pipeline = generate_training_data()
    df = pipeline  # generate_training_data returns fitted pipeline; we need data only
    # Correct: regenerate data separately, fit with proper labels
    df = generate_training_data()
    # Rebuild pipeline with same structure (data generator already fits; rebuild clean)
    np.random.seed(42)
    sources = ["Website", "LinkedIn", "Referral", "Email Campaign", "Cold Outreach", "Event"]
    industries = ["Technology", "Healthcare", "Finance", "Retail", "Manufacturing"]
    data = {
        "value": np.random.exponential(scale=45000, size=1000) + 5000,
        "source": np.random.choice(sources, size=1000, p=[0.25, 0.25, 0.2, 0.15, 0.1, 0.05]),
        "touchpoints": np.random.poisson(lam=4, size=1000) + 1,
        "industry": np.random.choice(industries, size=1000),
        "company_size": np.random.choice(["Startup", "Mid-Market", "Enterprise"], size=1000, p=[0.3, 0.45, 0.25]),
    }
    df = pd.DataFrame(data)
    source_weights = {"Referral": 0.4, "Website": 0.25, "LinkedIn": 0.2, "Email Campaign": 0.1, "Event": 0.3, "Cold Outreach": -0.1}
    size_weights = {"Enterprise": 0.35, "Mid-Market": 0.2, "Startup": 0.05}
    logits = (
        (df["value"] / 100000) * 0.4 +
        (df["touchpoints"] / 10) * 0.6 +
        df["source"].map(source_weights) +
        df["company_size"].map(size_weights) +
        np.random.normal(0, 0.2, size=1000)
    )
    prob = 1 / (1 + np.exp(-logits))
    y = (prob > 0.55).astype(int)
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", "passthrough", ["value", "touchpoints"]),
            ("cat", OneHotEncoder(handle_unknown="ignore"), ["source", "industry", "company_size"]),
        ]
    )
    pipeline = Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("classifier", RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42))
    ])
    pipeline.fit(df, y)
    joblib.dump(pipeline, MODEL_PATH)
    score = pipeline.score(df, y)
    return round(score * 100, 1)


def retrain_churn_model() -> Dict[str, Any]:
    from backend.models.churn_model import ChurnRiskModel
    model = ChurnRiskModel()
    return model.retrain()


def retrain_anomaly_detector() -> Dict[str, Any]:
    from backend.models.anomaly_detector import DealAnomalyDetector
    model = DealAnomalyDetector()
    return model.retrain()


def retrain_all() -> Dict[str, Any]:
    results: Dict[str, Any] = {}
    results["lead_scoring"] = retrain_lead_model()
    results["churn"] = retrain_churn_model()
    results["anomaly"] = retrain_anomaly_detector()
    return results


def main():
    import sys
    target = sys.argv[1] if len(sys.argv) > 1 else "all"
    if target == "lead":
        retrain_lead_model()
    elif target == "churn":
        retrain_churn_model()
    elif target == "anomaly":
        retrain_anomaly_detector()
    else:
        retrain_all()


if __name__ == "__main__":
    main()
