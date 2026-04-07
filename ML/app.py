from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import os

app = Flask(__name__)
CORS(app)

# ✅ FIXED PATH (works in local + deployment)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model.pkl")

print("MODEL PATH:", MODEL_PATH)
print("FILE EXISTS:", os.path.exists(MODEL_PATH))

# ✅ LOAD MODEL SAFELY
try:
    model = joblib.load(MODEL_PATH)
    print("✅ Model loaded successfully")
except Exception as e:
    model = None
    print("❌ Model load failed:", str(e))


# ── HEALTH CHECK ──
@app.route("/", methods=["GET"])
def health():
    return jsonify({
        "status": "PrepWise ML service running 🚀",
        "model_loaded": model is not None
    })


# ── /predict ENDPOINT ──
@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON body received"}), 400

        coding     = float(data.get("total_coding")     or data.get("coding")     or 0)
        aptitude   = float(data.get("total_aptitude")   or data.get("aptitude")   or 0)
        interviews = float(data.get("total_interviews") or data.get("interviews") or 0)
        study_hrs  = float(data.get("total_study_hrs")  or data.get("studyHours") or 0)

        features = [[coding, aptitude, interviews, study_hrs]]

        # ✅ FALLBACK (important for demo)
        if model is None:
            raw_score = coding*2 + aptitude*2 + interviews*3 + study_hrs
        else:
            raw_score = model.predict(features)[0]

        readiness_score = round(float(np.clip(raw_score, 0, 100)), 1)

        skill_scores = _compute_skill_scores(coding, aptitude, interviews, study_hrs)
        recommendations = _generate_recommendations(skill_scores)

        return jsonify({
            "readiness_score": readiness_score,
            "skill_scores":    skill_scores,
            "recommendations": recommendations,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── /score ENDPOINT (FRONTEND) ──
@app.route("/score", methods=["POST"])
def score():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON body received"}), 400

        coding     = float(data.get("codingHours")    or 0)
        aptitude   = float(data.get("aptitudeHours")  or 0)
        interviews = float(data.get("mockInterviews") or 0)
        study_hrs  = float(data.get("studyHours")     or 0)

        features = [[coding, aptitude, interviews, study_hrs]]

        # ✅ FALLBACK (MOST IMPORTANT FIX)
        if model is None:
            raw_score = coding*2 + aptitude*2 + interviews*3 + study_hrs
        else:
            raw_score = model.predict(features)[0]

        readiness_score = round(float(np.clip(raw_score, 0, 100)), 1)

        skill_scores = _compute_skill_scores(coding, aptitude, interviews, study_hrs)
        recommendations = _generate_recommendations(skill_scores)

        return jsonify({
            "score": readiness_score,
            "recommendations": recommendations,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── HELPERS ──
def _compute_skill_scores(coding, aptitude, interviews, study_hrs):
    def cap(val): return round(min(float(val), 100.0), 1)
    return {
        "dsa":            cap(coding * 0.75),
        "aptitude":       cap(aptitude * 3.5),
        "communication":  cap(interviews * 6.0),
        "system_design":  cap(study_hrs * 0.5),
        "projects":       cap((coding * 0.3 + study_hrs * 0.4)),
    }


def _generate_recommendations(skill_scores):
    ACTIONS = {
        "dsa":           {"action": "Solve 5 LeetCode problems daily (Graphs & DP)", "priority": "HIGH"},
        "aptitude":      {"action": "Practice 15 aptitude problems/day",             "priority": "HIGH"},
        "communication": {"action": "Give 2 mock interviews this week",              "priority": "HIGH"},
        "system_design": {"action": "Study HLD/LLD patterns",                        "priority": "MED"},
        "projects":      {"action": "Build 1 full project with docs",                "priority": "MED"},
    }

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


# ✅ RUN
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)