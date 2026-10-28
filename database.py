"""
Database module for AI Spam Message Detector using SQLite.
Stores analysis history and provides statistical queries for analytics.
"""

import os
import sqlite3
import json
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "spam_detector.db")


def get_db_connection():
    """Get a SQLite connection configured with Row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize database tables and seed with realistic starter records if empty."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS analysis_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message TEXT NOT NULL,
                prediction TEXT NOT NULL,
                is_spam INTEGER NOT NULL,
                spam_probability REAL NOT NULL,
                ham_probability REAL NOT NULL,
                keywords TEXT,
                char_count INTEGER,
                word_count INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.commit()

        # Check if database is empty; if so, seed sample records
        cursor.execute("SELECT COUNT(*) FROM analysis_history")
        count = cursor.fetchone()[0]
        if count == 0:
            seed_initial_records(conn)


def seed_initial_records(conn):
    """Seed initial records for history and statistics preview."""
    now = datetime.now()
    sample_records = [
        (
            "URGENT! You have won a £1,000 Walmart gift card. Click http://bit.ly/gift-card to claim immediately. Valid 24 hours.",
            "Spam",
            1,
            99.2,
            0.8,
            json.dumps(["urgent", "won", "gift card", "claim", "http"]),
            118,
            18,
            (now - timedelta(hours=5)).strftime("%Y-%m-%d %H:%M:%S"),
        ),
        (
            "Hey Sarah, are we still meeting for lunch at 12:30 today? Let me know if that works for you!",
            "Not Spam",
            0,
            1.2,
            98.8,
            json.dumps(["meeting", "lunch", "today", "works"]),
            88,
            18,
            (now - timedelta(hours=4, minutes=15)).strftime("%Y-%m-%d %H:%M:%S"),
        ),
        (
            "Congratulations! Your entry for the Barclays prize draw was selected. Call 0800-888-999 now to collect your £500 award.",
            "Spam",
            1,
            98.7,
            1.3,
            json.dumps(["congratulations", "prize", "selected", "call", "award"]),
            122,
            19,
            (now - timedelta(hours=3, minutes=30)).strftime("%Y-%m-%d %H:%M:%S"),
        ),
        (
            "Can you please review the attached slide deck before the client presentation tomorrow morning? Thanks!",
            "Not Spam",
            0,
            0.8,
            99.2,
            json.dumps(["review", "presentation", "tomorrow", "thanks"]),
            104,
            15,
            (now - timedelta(hours=2, minutes=45)).strftime("%Y-%m-%d %H:%M:%S"),
        ),
        (
            "WINNER! As an active customer you have been selected for a free holiday voucher! Reply YES to receive details now.",
            "Spam",
            1,
            99.5,
            0.5,
            json.dumps(["winner", "customer", "free", "voucher", "reply"]),
            114,
            19,
            (now - timedelta(hours=1, minutes=50)).strftime("%Y-%m-%d %H:%M:%S"),
        ),
        (
            "I will be arriving at the train station around 6:15 PM. No need to cook tonight, let's grab takeaway.",
            "Not Spam",
            0,
            1.5,
            98.5,
            json.dumps(["train station", "cook", "tonight", "takeaway"]),
            102,
            19,
            (now - timedelta(minutes=40)).strftime("%Y-%m-%d %H:%M:%S"),
        ),
        (
            "Security Alert: Your PayPal account has been restricted due to suspicious activity. Verify identity at http://pay-secure.verify.io",
            "Spam",
            1,
            97.8,
            2.2,
            json.dumps(["alert", "restricted", "verify", "identity", "http"]),
            135,
            17,
            (now - timedelta(minutes=15)).strftime("%Y-%m-%d %H:%M:%S"),
        ),
        (
            "Mom called earlier and asked if you're coming over for Sunday dinner. Call her back when you get a chance.",
            "Not Spam",
            0,
            0.6,
            99.4,
            json.dumps(["called", "dinner", "sunday", "chance"]),
            107,
            19,
            (now - timedelta(minutes=5)).strftime("%Y-%m-%d %H:%M:%S"),
        ),
    ]

    cursor = conn.cursor()
    cursor.executemany(
        """
        INSERT INTO analysis_history (
            message, prediction, is_spam, spam_probability, ham_probability,
            keywords, char_count, word_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        sample_records,
    )
    conn.commit()


def add_history_record(message: str, prediction: str, is_spam: bool, spam_prob: float, ham_prob: float, keywords: list):
    """Insert a new analysis record into the database."""
    char_count = len(message)
    word_count = len(message.split())
    keywords_json = json.dumps(keywords if keywords else [])
    is_spam_int = 1 if is_spam else 0

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO analysis_history (
                message, prediction, is_spam, spam_probability, ham_probability,
                keywords, char_count, word_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                message,
                prediction,
                is_spam_int,
                round(spam_prob, 2),
                round(ham_prob, 2),
                keywords_json,
                char_count,
                word_count,
            ),
        )
        conn.commit()
        return cursor.lastrowid


def get_history(search=None, filter_type=None, limit=100):
    """Retrieve history records with optional search query and category filter."""
    query = "SELECT * FROM analysis_history WHERE 1=1"
    params = []

    if filter_type == "spam":
        query += " AND is_spam = 1"
    elif filter_type == "ham":
        query += " AND is_spam = 0"

    if search and search.strip():
        query += " AND message LIKE ?"
        params.append(f"%{search.strip()}%")

    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()

    results = []
    for r in rows:
        results.append(
            {
                "id": r["id"],
                "message": r["message"],
                "prediction": r["prediction"],
                "is_spam": bool(r["is_spam"]),
                "spam_probability": r["spam_probability"],
                "ham_probability": r["ham_probability"],
                "keywords": json.loads(r["keywords"]) if r["keywords"] else [],
                "char_count": r["char_count"],
                "word_count": r["word_count"],
                "created_at": r["created_at"],
            }
        )
    return results


def delete_history_record(record_id: int):
    """Delete a single history entry by its ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM analysis_history WHERE id = ?", (record_id,))
        conn.commit()
        return cursor.rowcount > 0


def clear_all_history():
    """Remove all records from analysis_history."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM analysis_history")
        conn.commit()
        return True


def get_analytics_summary():
    """Aggregate statistics for the analytics dashboard."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Total counts
        cursor.execute("SELECT COUNT(*) FROM analysis_history")
        total = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM analysis_history WHERE is_spam = 1")
        spam_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM analysis_history WHERE is_spam = 0")
        ham_count = cursor.fetchone()[0]

        # Average probabilities
        cursor.execute("SELECT AVG(spam_probability), AVG(ham_probability) FROM analysis_history")
        avg_row = cursor.fetchone()
        avg_spam_prob = round(avg_row[0] or 0.0, 1)
        avg_ham_prob = round(avg_row[1] or 0.0, 1)

        # Confidence distribution buckets
        # High confidence (>= 90%), Medium (70-89%), Low (< 70%)
        cursor.execute(
            """
            SELECT 
                SUM(CASE WHEN MAX(spam_probability, ham_probability) >= 90 THEN 1 ELSE 0 END) AS high_conf,
                SUM(CASE WHEN MAX(spam_probability, ham_probability) >= 70 AND MAX(spam_probability, ham_probability) < 90 THEN 1 ELSE 0 END) AS med_conf,
                SUM(CASE WHEN MAX(spam_probability, ham_probability) < 70 THEN 1 ELSE 0 END) AS low_conf
            FROM analysis_history
            """
        )
        conf_row = cursor.fetchone()
        conf_buckets = {
            "high": conf_row[0] or 0,
            "medium": conf_row[1] or 0,
            "low": conf_row[2] or 0,
        }

        # Daily activity for the past 7 days
        cursor.execute(
            """
            SELECT date(created_at) as day, 
                   COUNT(*) as total_day,
                   SUM(CASE WHEN is_spam = 1 THEN 1 ELSE 0 END) as spam_day,
                   SUM(CASE WHEN is_spam = 0 THEN 1 ELSE 0 END) as ham_day
            FROM analysis_history
            GROUP BY date(created_at)
            ORDER BY date(created_at) DESC
            LIMIT 7
            """
        )
        daily_rows = cursor.fetchall()
        daily_stats = [
            {
                "date": r["day"],
                "total": r["total_day"],
                "spam": r["spam_day"],
                "ham": r["ham_day"],
            }
            for r in reversed(daily_rows)
        ]

    spam_percentage = round((spam_count / total * 100), 1) if total > 0 else 0
    ham_percentage = round((ham_count / total * 100), 1) if total > 0 else 0

    return {
        "total_analyzed": total,
        "spam_count": spam_count,
        "ham_count": ham_count,
        "spam_percentage": spam_percentage,
        "ham_percentage": ham_percentage,
        "avg_spam_prob": avg_spam_prob,
        "avg_ham_prob": avg_ham_prob,
        "confidence_buckets": conf_buckets,
        "daily_stats": daily_stats,
    }
