"""
Flask Application for AI Spam Message Detector
Provides web UI routes and RESTful API endpoints.
"""

import os
import re
import numpy as np
from flask import Flask, render_template, request, jsonify

import database
from model_trainer import load_model_and_vectorizer, clean_text

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "spam-detector-secret-key-2026")

# Initialize database
database.init_db()

# Load trained Machine Learning model, vectorizer, and metrics
model, vectorizer, model_metrics = load_model_and_vectorizer()

# Precompute feature names and log probability difference for fast keyword explainability
feature_names = np.array(vectorizer.get_feature_names_out())
classes = list(model.classes_)
spam_class_idx = classes.index("spam")
ham_class_idx = classes.index("ham")
log_prob_diff = model.feature_log_prob_[spam_class_idx] - model.feature_log_prob_[ham_class_idx]


def analyze_message_content(raw_text: str):
    """Run full NLP feature extraction, classification, and explainability."""
    cleaned = clean_text(raw_text)

    # Transform using fitted TF-IDF Vectorizer
    vec_input = vectorizer.transform([cleaned])

    # Multinomial Naive Bayes prediction
    prediction_raw = model.predict(vec_input)[0]
    probabilities = model.predict_proba(vec_input)[0]

    spam_prob = float(probabilities[spam_class_idx]) * 100
    ham_prob = float(probabilities[ham_class_idx]) * 100

    is_spam = bool(prediction_raw == "spam")
    label = "Spam" if is_spam else "Not Spam"
    confidence = round(spam_prob if is_spam else ham_prob, 2)

    # Keyword Explainability: find non-zero TF-IDF words in message and evaluate their influence
    nonzero_indices = vec_input.nonzero()[1]
    highlighted_words = []

    if len(nonzero_indices) > 0:
        found_words = feature_names[nonzero_indices]
        word_scores = log_prob_diff[nonzero_indices]
        tfidf_weights = vec_input.data

        # Sort by impact
        # Positive score -> contributes to Spam; Negative score -> contributes to Ham
        ranked_tokens = sorted(
            zip(found_words, word_scores, tfidf_weights),
            key=lambda x: abs(x[1]),
            reverse=True,
        )

        for word, score, weight in ranked_tokens[:8]:
            category = "spam" if score > 0 else "ham"
            highlighted_words.append(
                {
                    "word": str(word),
                    "impact": "Spam Indicator" if category == "spam" else "Ham Indicator",
                    "category": category,
                    "score": round(float(score), 2),
                    "tfidf": round(float(weight), 3),
                }
            )

    # Heuristic and pattern analysis
    has_url = bool(re.search(r"https?://|www\.|\.com|\.ly|\.io|\.org", raw_text, re.IGNORECASE))
    has_phone = bool(re.search(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b", raw_text))
    has_currency = bool(re.search(r"[\$£€₹]|(\b(?:usd|gbp|eur|inr|cash|prize)\b)", raw_text, re.IGNORECASE))
    char_count = len(raw_text)
    word_count = len(raw_text.split())
    letters = [c for c in raw_text if c.isalpha()]
    upper_letters = [c for c in letters if c.isupper()]
    upper_ratio = round((len(upper_letters) / len(letters) * 100), 1) if letters else 0.0

    return {
        "prediction": label,
        "is_spam": is_spam,
        "confidence": confidence,
        "spam_probability": round(spam_prob, 2),
        "ham_probability": round(ham_prob, 2),
        "keywords": [k["word"] for k in highlighted_words],
        "detailed_keywords": highlighted_words,
        "metadata": {
            "char_count": char_count,
            "word_count": word_count,
            "uppercase_ratio": upper_ratio,
            "has_url": has_url,
            "has_phone": has_phone,
            "has_currency": has_currency,
        },
    }


@app.route("/")
def index():
    """Main Home page dashboard."""
    stats = database.get_analytics_summary()
    recent_history = database.get_history(limit=10)
    return render_template(
        "index.html",
        stats=stats,
        history=recent_history,
        metrics=model_metrics,
    )


@app.route("/api/predict", methods=["POST"])
def predict_endpoint():
    """API endpoint to classify SMS message."""
    data = request.get_json(silent=True) or {}
    message = data.get("message", "").strip()

    if not message:
        return jsonify({"error": "Message text cannot be empty."}), 400

    if len(message) > 5000:
        return jsonify({"error": "Message is too long. Limit is 5000 characters."}), 400

    # Run AI analysis
    result = analyze_message_content(message)

    # Save to SQLite history
    record_id = database.add_history_record(
        message=message,
        prediction=result["prediction"],
        is_spam=result["is_spam"],
        spam_prob=result["spam_probability"],
        ham_prob=result["ham_probability"],
        keywords=result["keywords"],
    )
    result["id"] = record_id
    result["message"] = message

    return jsonify(result)


@app.route("/api/history", methods=["GET"])
def history_endpoint():
    """API endpoint to get analysis history."""
    search = request.args.get("search", None)
    filter_type = request.args.get("filter", "all")
    limit = int(request.args.get("limit", 50))

    records = database.get_history(search=search, filter_type=filter_type, limit=limit)
    return jsonify(records)


@app.route("/api/history/<int:record_id>", methods=["DELETE"])
def delete_history_item(record_id):
    """API endpoint to delete a specific history record."""
    success = database.delete_history_record(record_id)
    if success:
        return jsonify({"success": True, "message": f"Record {record_id} deleted."})
    return jsonify({"error": "Record not found."}), 404


@app.route("/api/history/clear", methods=["POST", "DELETE"])
def clear_history_endpoint():
    """API endpoint to clear all history."""
    database.clear_all_history()
    return jsonify({"success": True, "message": "All history cleared."})


@app.route("/api/analytics", methods=["GET"])
def analytics_endpoint():
    """API endpoint for live dashboard analytics."""
    summary = database.get_analytics_summary()
    return jsonify(
        {
            "summary": summary,
            "metrics": model_metrics,
        }
    )


@app.route("/api/model-info", methods=["GET"])
def model_info_endpoint():
    """API endpoint to return model architecture & training details."""
    return jsonify(
        {
            "model_name": "Multinomial Naive Bayes",
            "feature_extractor": "TF-IDF (Term Frequency - Inverse Document Frequency)",
            "hyperparameters": {
                "alpha": 0.2,
                "ngram_range": [1, 2],
                "sublinear_tf": True,
                "max_features": 6000,
                "stop_words": "english",
            },
            "metrics": model_metrics,
        }
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
