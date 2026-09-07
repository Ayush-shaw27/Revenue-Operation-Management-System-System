import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from typing import Dict, Any, List, Optional

class LeadScoringModel:
    def __init__(self):
        self.model_path = os.path.join(os.path.dirname(__file__), "..", "lead_scoring_model.joblib")
        self.model = None
        self.is_trained = False
        if os.path.exists(self.model_path):
            self._load_model()
        else:
            self._train_initial_model()

    def _train_initial_model(self):
        # Generate synthetic historical enterprise B2B sales data
        np.random.seed(42)
        n_samples = 800

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

        # Realistic conversion logic calculation for training targets
        source_weights = {"Referral": 0.4, "Website": 0.25, "LinkedIn": 0.2, "Email Campaign": 0.1, "Event": 0.3, "Cold Outreach": -0.1}
        size_weights = {"Enterprise": 0.35, "Mid-Market": 0.2, "Startup": 0.05}

        logits = (
            (df["value"] / 100000) * 0.4 +
            (df["touchpoints"] / 10) * 0.6 +
            df["source"].map(source_weights) +
            df["company_size"].map(size_weights) +
            np.random.normal(0, 0.2, size=n_samples)
        )

        # Binary target: 1 = Converted, 0 = Lost
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

        self.pipeline = Pipeline(steps=[
            ("preprocessor", preprocessor),
            ("classifier", RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42))
        ])

        self.pipeline.fit(df, y)
        self.is_trained = True
        self._save_model()

    def _load_model(self):
        try:
            self.pipeline = joblib.load(self.model_path)
            self.is_trained = True
        except Exception as e:
            raise RuntimeError(f"Failed to load model: {e}")

    def _save_model(self):
        try:
            joblib.dump(self.pipeline, self.model_path)
        except Exception as e:
            raise RuntimeError(f"Failed to save model: {e}")

    def predict(self, lead_data: Dict[str, Any]) -> Dict[str, Any]:
        df_input = pd.DataFrame([{
            "value": float(lead_data.get("value", 30000)),
            "source": str(lead_data.get("source", "Website")),
            "touchpoints": int(lead_data.get("touchpoints", 3)),
            "industry": str(lead_data.get("industry", "Technology")),
            "company_size": str(lead_data.get("company_size", "Mid-Market")),
        }])

        proba = self.pipeline.predict_proba(df_input)[0][1]
        score = int(np.clip(round(proba * 100), 1, 99))

        # Determine label
        if score >= 80:
            label = "Hot"
        elif score >= 60:
            label = "Warm"
        elif score >= 40:
            label = "Cool"
        else:
            label = "Cold"

        # Explainable factors
        factors = []
        val = df_input["value"].iloc[0]
        src = df_input["source"].iloc[0]
        tp = df_input["touchpoints"].iloc[0]
        csize = df_input["company_size"].iloc[0]

        if val >= 50000:
            factors.append("High deal value potential")
        elif val < 15000:
            factors.append("Lower contract value tier")

        if src in ["Referral", "Website", "Event"]:
            factors.append(f"Strong inbound channel ({src})")
        else:
            factors.append(f"Outbound acquisition ({src})")

        if tp >= 4:
            factors.append("High multi-touch engagement")
        else:
            factors.append("Early stage engagement")

        if csize == "Enterprise":
            factors.append("Enterprise buying power")

        confidence = int(np.clip(75 + abs(score - 50) * 0.45, 70, 96))

        feature_contributions = {
            "value": float(val) / 100000.0,
            "source": 0.35 if src in ("Referral","Website","Event") else 0.15,
            "touchpoints": float(tp) / 10.0,
            "company_size": 0.35 if csize == "Enterprise" else 0.2,
        }
        top_features = sorted(feature_contributions.items(), key=lambda x: x[1], reverse=True)[:3]
        top_contributions = [{"feature": k, "contribution": round(v, 3)} for k, v in top_features]

        return {
            "score": score,
            "label": label,
            "conversion_probability": round(float(proba), 3),
            "confidence": confidence,
            "factors": factors[:3],
            "top_feature_contributions": top_contributions,
        }