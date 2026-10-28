"""
Model Trainer for AI Spam Message Detector
Uses TF-IDF Vectorization and Multinomial Naive Bayes classification.
"""

import os
import json
import re
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data", "sms_spam_collection.csv")
MODEL_DIR = os.path.join(BASE_DIR, "models")
MODEL_PATH = os.path.join(MODEL_DIR, "spam_model.joblib")
VECTORIZER_PATH = os.path.join(MODEL_DIR, "vectorizer.joblib")
METRICS_PATH = os.path.join(MODEL_DIR, "model_metrics.json")


def clean_text(text: str) -> str:
    """Preprocess text: strip extra whitespace and normalize basic characters."""
    if not isinstance(text, str):
        return ""
    text = re.sub(r"\s+", " ", text).strip()
    return text


def train_and_save_model():
    """Train the TF-IDF + Multinomial Naive Bayes model and save artifacts."""
    os.makedirs(MODEL_DIR, exist_ok=True)

    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Dataset not found at {DATA_PATH}")

    # Load dataset
    df = pd.read_csv(DATA_PATH)
    df = df.dropna(subset=["message", "label"])
    df["clean_message"] = df["message"].apply(clean_text)

    # 1. Stratified Train-Test Split for rigorous validation
    X_train, X_test, y_train, y_test = train_test_split(
        df["clean_message"],
        df["label"],
        test_size=0.20,
        random_state=42,
        stratify=df["label"],
    )

    # 2. TF-IDF Feature Extraction
    eval_vectorizer = TfidfVectorizer(
        stop_words="english",
        lowercase=True,
        ngram_range=(1, 2),
        max_features=5000,
        sublinear_tf=True,
    )
    X_train_vec = eval_vectorizer.fit_transform(X_train)
    X_test_vec = eval_vectorizer.transform(X_test)

    # 3. Multinomial Naive Bayes Classifier
    eval_clf = MultinomialNB(alpha=0.2)
    eval_clf.fit(X_train_vec, y_train)

    y_pred = eval_clf.predict(X_test_vec)

    # Calculate metrics
    accuracy = float(accuracy_score(y_test, y_pred))
    precision, recall, f1, support = precision_recall_fscore_support(
        y_test, y_pred, labels=["ham", "spam"]
    )
    cm = confusion_matrix(y_test, y_pred, labels=["ham", "spam"]).tolist()

    # 4. Train final production model on the entire dataset for maximum vocabulary & accuracy
    prod_vectorizer = TfidfVectorizer(
        stop_words="english",
        lowercase=True,
        ngram_range=(1, 2),
        max_features=6000,
        sublinear_tf=True,
    )
    X_all_vec = prod_vectorizer.fit_transform(df["clean_message"])
    prod_clf = MultinomialNB(alpha=0.2)
    prod_clf.fit(X_all_vec, df["label"])

    # 5. Extract top spam & ham indicator words using feature log probability differences
    # classes_: ['ham', 'spam'] -> [0] is ham, [1] is spam
    classes = list(prod_clf.classes_)
    spam_idx = classes.index("spam")
    ham_idx = classes.index("ham")

    feature_names = np.array(prod_vectorizer.get_feature_names_out())
    log_prob_diff = prod_clf.feature_log_prob_[spam_idx] - prod_clf.feature_log_prob_[ham_idx]

    top_spam_indices = np.argsort(log_prob_diff)[::-1][:20]
    top_ham_indices = np.argsort(log_prob_diff)[:20]

    top_spam_words = [
        {"word": str(feature_names[i]), "weight": round(float(log_prob_diff[i]), 2)}
        for i in top_spam_indices
    ]
    top_ham_words = [
        {"word": str(feature_names[i]), "weight": round(float(-log_prob_diff[i]), 2)}
        for i in top_ham_indices
    ]

    metrics = {
        "dataset_total": int(len(df)),
        "dataset_ham_count": int((df["label"] == "ham").sum()),
        "dataset_spam_count": int((df["label"] == "spam").sum()),
        "test_size": int(len(y_test)),
        "accuracy": round(accuracy * 100, 2),
        "precision_spam": round(float(precision[1]) * 100, 2),
        "recall_spam": round(float(recall[1]) * 100, 2),
        "f1_spam": round(float(f1[1]) * 100, 2),
        "precision_ham": round(float(precision[0]) * 100, 2),
        "recall_ham": round(float(recall[0]) * 100, 2),
        "f1_ham": round(float(f1[0]) * 100, 2),
        "confusion_matrix": {
            "true_ham_pred_ham": cm[0][0],
            "true_ham_pred_spam": cm[0][1],
            "true_spam_pred_ham": cm[1][0],
            "true_spam_pred_spam": cm[1][1],
        },
        "vocabulary_size": int(len(feature_names)),
        "top_spam_words": top_spam_words,
        "top_ham_words": top_ham_words,
    }

    # Save artifacts
    joblib.dump(prod_clf, MODEL_PATH)
    joblib.dump(prod_vectorizer, VECTORIZER_PATH)
    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print(f"Model saved successfully to {MODEL_PATH}")
    print(f"Vectorizer saved to {VECTORIZER_PATH}")
    print(f"Metrics saved to {METRICS_PATH}")
    print(f"Evaluation Accuracy: {accuracy * 100:.2f}% | Spam Precision: {precision[1]*100:.2f}%")
    return prod_clf, prod_vectorizer, metrics


def load_model_and_vectorizer():
    """Load model, vectorizer, and metrics. Retrains if files are missing."""
    if not (os.path.exists(MODEL_PATH) and os.path.exists(VECTORIZER_PATH) and os.path.exists(METRICS_PATH)):
        return train_and_save_model()

    model = joblib.load(MODEL_PATH)
    vectorizer = joblib.load(VECTORIZER_PATH)
    with open(METRICS_PATH, "r", encoding="utf-8") as f:
        metrics = json.load(f)
    return model, vectorizer, metrics


if __name__ == "__main__":
    train_and_save_model()
