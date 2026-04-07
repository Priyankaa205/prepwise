import pandas as pd # type: ignore
from sklearn.linear_model import LinearRegression # type: ignore
from sklearn.preprocessing import MinMaxScaler # type: ignore
import joblib # type: ignore
import numpy as np # type: ignore

# ─────────────────────────────────────────────────
# TRAINING DATA
# Realistic dataset — 20 samples
# Features: coding problems, aptitude tests,
#           mock interviews, study hours (cumulative)
# Score: placement readiness 0-100
# ─────────────────────────────────────────────────
data = pd.DataFrame({
    "coding":      [0,  1,  2,  3,  5,  8, 10, 12, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 100, 120],
    "aptitude":    [0,  0,  1,  1,  2,  3,  4,  5,  6,  8, 10, 12, 14, 16, 20, 24, 28, 32,  38,  45],
    "interviews":  [0,  0,  0,  1,  1,  1,  2,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12,  13,  15],
    "studyHours":  [0,  2,  4,  5,  8, 10, 15, 18, 22, 28, 35, 42, 50, 58, 70, 82, 92,102, 115, 130],
    "score":       [5, 12, 18, 22, 30, 38, 44, 50, 55, 62, 67, 72, 76, 79, 83, 87, 90, 93,  97, 100],
})

FEATURES = ["coding", "aptitude", "interviews", "studyHours"]

X = data[FEATURES]
y = data["score"]

model = LinearRegression()
model.fit(X, y)

# Save model
joblib.dump(model, "model.pkl")
print("✅ model.pkl saved")
print(f"   R² score on training data: {model.score(X, y):.3f}")
print(f"   Coefficients: {dict(zip(FEATURES, model.coef_.round(3)))}")

# Quick sanity check
sample = pd.DataFrame([{"coding": 11, "aptitude": 1, "interviews": 9, "studyHours": 13}])
pred = model.predict(sample)[0]
print(f"   Sample prediction (Arjun's data): {round(float(np.clip(pred, 0, 100)), 1)}")