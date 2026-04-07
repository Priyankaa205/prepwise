from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import os

app = Flask(__name__)
CORS(app)  # ← React frontend se calls allow karo

# ─────────────────────────────────────────────────
# LOAD MODEL ONCE AT STARTUP
# ─────────────────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")

try:
    model = joblib.load(MODEL_PATH)
    print(f"✅ Model loaded from {MODEL_PATH}")
except FileNotFoundError:
    model = None
    print("⚠️  model.pkl not found — run model.py first to train and save it")


# ─────────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────────
@app.route("/", methods=["GET"])
def health():
    return jsonify({
        "status": "PrepWise ML service running 🚀",
        "model_loaded": model is not None
    })


# ─────────────────────────────────────────────────
# PREDICT ENDPOINT
# POST /predict
#
# Expected JSON body (from Node.js server):
# {
#   "total_coding":     <int>,
#   "total_aptitude":   <int>,
#   "total_interviews": <int>,
#   "total_study_hrs":  <float>,
#   "active_days":      <int>   ← optional, not used in model yet
# }
#
# Response:
# {
#   "readiness_score": <float 0-100>,
#   "skill_scores":    { dsa, aptitude, communication, system_design, projects },
#   "recommendations": [ { skill, action, priority } ]
# }
# ─────────────────────────────────────────────────
@app.route("/predict", methods=["POST"])
def predict():
    if model is None:
        return jsonify({"error": "Model not loaded. Run model.py first."}), 503

    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body received"}), 400

    # Accept both naming conventions (from Node.js or direct calls)
    coding     = float(data.get("total_coding")     or data.get("coding")     or 0)
    aptitude   = float(data.get("total_aptitude")   or data.get("aptitude")   or 0)
    interviews = float(data.get("total_interviews") or data.get("interviews") or 0)
    study_hrs  = float(data.get("total_study_hrs")  or data.get("studyHours") or 0)

    features = [[coding, aptitude, interviews, study_hrs]]

    raw_score = model.predict(features)[0]
    # Clamp to 0-100
    readiness_score = round(float(np.clip(raw_score, 0, 100)), 1)

    # ── Derived skill scores (heuristic from activity data) ──
    skill_scores = _compute_skill_scores(coding, aptitude, interviews, study_hrs)

    # ── Recommendations based on skill gaps ──
    recommendations = _generate_recommendations(skill_scores)

    return jsonify({
        "readiness_score":  readiness_score,
        "skill_scores":     skill_scores,
        "recommendations":  recommendations,
    })


# ─────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────
def _compute_skill_scores(coding, aptitude, interviews, study_hrs):
    """
    Simple heuristic to estimate individual skill levels
    from cumulative activity counts.
    Replace with separate trained models later.
    """
    def cap(val): return round(min(float(val), 100.0), 1)

    return {
        "dsa":            cap(coding     * 0.75),
        "aptitude":       cap(aptitude   * 3.5),
        "communication":  cap(interviews * 6.0),
        "system_design":  cap(study_hrs  * 0.5),
        "projects":       cap((coding * 0.3 + study_hrs * 0.4)),
    }


def _generate_recommendations(skill_scores):
    """Return top 3 recommendations for lowest scoring skills."""
    ACTIONS = {
        "dsa":           {"action": "Solve 5 LeetCode problems daily (focus: Graphs & DP)", "priority": "HIGH"},
        "aptitude":      {"action": "Practice 15 quant & logical reasoning problems/day",   "priority": "HIGH"},
        "communication": {"action": "Complete 2 mock interviews this week",                  "priority": "HIGH"},
        "system_design": {"action": "Study HLD/LLD patterns — Factory, Singleton, CQRS",    "priority": "MED"},
        "projects":      {"action": "Build one end-to-end project with full documentation",  "priority": "MED"},
    }

    # Sort skills by score ascending — lowest first
    sorted_skills = sorted(skill_scores.items(), key=lambda x: x[1])

    recommendations = []
    for skill, score in sorted_skills[:3]:
        recommendations.append({
            "skill":    skill,
            "score":    score,
            "action":   ACTIONS[skill]["action"],
            "priority": ACTIONS[skill]["priority"],
            "delta":    f"+{round((100 - score) * 0.15, 1)}%",
        })

    return recommendations


# ─────────────────────────────────────────────────
# START
# ─────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(port=8000, debug=False)