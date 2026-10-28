# 🛡️ AI Spam Message Detector & Classifier

An end-to-end Machine Learning web application that classifies SMS messages as **Spam** or **Legitimate (Not Spam)** in real time. Built with **Python Flask**, **Scikit-learn**, **TF-IDF Vectorization**, and **Multinomial Naive Bayes**, featuring a modern responsive dashboard and pre-configured for one-click deployment to **Render**.

---

## 🌟 Key Features & Components

### 1. Home Page & Dashboard
- **Executive Metrics**: Displays real-time counts of total scanned messages, spam rate, legitimate count, and ML model accuracy (98.21%).
- **Intuitive Navigation**: Seamless client-side tab navigation between Detector, History, Analytics, About AI, and Render Deployment Guide.

### 2. Message Input Interface
- **Comfortable Text Area**: Enter or paste SMS messages with real-time character and word count tracking.
- **Quick-Test Sample Buttons**: One-click pills to test typical spam (prize notifications, phishing gift cards, lottery scams) and authentic ham messages.
- **Productivity Shortcuts**: Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> (or <kbd>Cmd</kbd> + <kbd>Enter</kbd>) to instantly trigger analysis.
- **Clear Button**: Instantly resets the input and results view.

### 3. AI Prediction Engine
- **Text Preprocessing**: Lowercasing, whitespace normalization, and punctuation tokenization.
- **TF-IDF Feature Extraction**: Evaluates unigrams and bigrams (`ngram_range=(1,2)`) with sublinear term frequency scaling and English stop-word filtering.
- **Multinomial Naive Bayes Classifier**: Probabilistic classification with Laplace smoothing (`alpha=0.2`).
- **Keyword Explainability**: Extracts and ranks the most influential words in the message that drove the classification decision.

### 4. Prediction Results Display
- **Color-Coded Verdict Banner**: High-impact red banner with alert icon for Spam, green shield banner for Legitimate communication.
- **Dual Probability Meter**: Visual progress bars displaying exact probability percentages for both Spam and Ham.
- **Indicator Keyword Badges**: Highlights the specific tokens that influenced the model with their log-odds impact score.
- **Pattern Analysis**: Identifies message character length, word count, uppercase percentage, hyperlinks, phone numbers, and currency symbols.
- **Export / Copy**: Copy structured results directly to clipboard.

### 5. Analysis History
- **SQLite Database Persistence**: Every analyzed message is logged with its timestamp, verdict, confidence, and detected keywords.
- **Search & Filter**: Search message snippets and filter by *All*, *Spam Only*, or *Legitimate Only*.
- **Record Management**: Delete individual entries or clear all history with one click.
- **CSV Export**: Export your historical classification logs to a `.csv` file.

### 6. Statistics & Analytics
- **Interactive Chart.js Visualizations**:
  - **Spam vs. Legitimate Donut Chart**: Proportional distribution of analyzed messages.
  - **Confidence Distribution Bar Chart**: Tracks high, medium, and low confidence decisions.
  - **Activity Timeline Chart**: Displays volume and ratio over time.
  - **Top Spam Vocabulary Bar Chart**: Displays top discriminative spam keywords from the dataset.

### 7. About AI & Model Architecture
- Explains the mathematical formulations of **TF-IDF** and **Bayes' Theorem** with conditional probability.
- Details the **SMS Spam Collection Dataset** (5,572 messages) and evaluation benchmarks (98.21% Accuracy, 97.78% Spam Precision).

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, CSS3 (Modern Glassmorphism & Responsive Design), JavaScript (ES6+), Chart.js 4, FontAwesome 6 |
| **Backend** | Python Flask, Gunicorn |
| **Machine Learning** | Scikit-learn (TfidfVectorizer, MultinomialNB), Joblib, NumPy, Pandas |
| **Database** | SQLite (Zero-configuration persistent SQL database) |
| **Dataset** | UCI SMS Spam Collection Dataset (5,572 SMS records) |
| **Hosting & Cloud** | Render Web Service (`render.yaml`, `Procfile`) |

---

## 📁 Project Structure

```
AI project/
├── app.py                      # Flask backend & REST API endpoints
├── database.py                 # SQLite database models, queries, and seeding
├── model_trainer.py            # ML pipeline: TF-IDF + Multinomial Naive Bayes training
├── tests.py                    # Automated test suite for endpoints & ML engine
├── requirements.txt            # Production dependencies
├── Procfile                    # Render / Gunicorn web process definition
├── render.yaml                 # Render Blueprint Infrastructure-as-Code
├── .gitignore                  # Git exclusions (venv, caches, etc.)
├── README.md                   # Complete documentation
├── data/
│   └── sms_spam_collection.csv # 5,572 labeled SMS messages
├── models/
│   ├── spam_model.joblib       # Trained MultinomialNB classifier
│   ├── vectorizer.joblib       # Fitted TfidfVectorizer
│   └── model_metrics.json      # Accuracy, precision, recall, and top keywords
├── static/
│   ├── css/
│   │   └── style.css           # Glassmorphism dark theme styling
│   └── js/
│       └── main.js             # AJAX requests, Chart.js graphs, UI logic
└── templates/
    └── index.html              # Main application dashboard
```

---

## 🚀 Local Installation & Running

### 1. Clone or Open the Project
```bash
cd "AI project"
```

### 2. Set Up Python Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. (Optional) Retrain Model
The model comes pre-trained, but you can retrain it anytime:
```bash
python model_trainer.py
```

### 5. Run Automated Tests
```bash
python tests.py
```

### 6. Start the Flask Server
```bash
python app.py
```
Open [http://localhost:5000](http://localhost:5000) in your browser!

---

## 🌐 Deploying to Render (Step-by-Step)

This application is 100% prepared for free deployment on **Render**:

### Step 1: Push Code to GitHub
```bash
git init
git add .
git commit -m "Initial commit: AI Spam Message Detector"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ai-spam-detector.git
git push -u origin main
```

### Step 2: Create a Web Service on Render
1. Visit [dashboard.render.com](https://dashboard.render.com/) and log in (or sign up with GitHub).
2. Click the **"New +"** button in the upper right and select **"Web Service"**.
3. Under **"Connect a repository"**, select your `ai-spam-detector` GitHub repository.

### Step 3: Configure Settings
Fill out the service configuration:
- **Name**: `ai-spam-detector` (or any custom name)
- **Language / Runtime**: `Python 3`
- **Region**: Choose the region closest to you (e.g. Frankfurt, Oregon, Singapore)
- **Branch**: `main`
- **Build Command**:
  ```bash
  pip install -r requirements.txt
  ```
- **Start Command**:
  ```bash
  gunicorn app:app
  ```
- **Plan**: `Free`

### Step 4: Click "Create Web Service"
Render will automatically clone the repository, install packages from `requirements.txt`, start Gunicorn, and allocate a live secure URL (`https://ai-spam-detector.onrender.com`).

---

## 📡 REST API Documentation

### `POST /api/predict`
Analyzes an SMS message and records it in history.

**Request Body:**
```json
{
  "message": "WINNER! You have won a £1,000 cash prize. Call 09061701461 now to claim!"
}
```

**Response Body:**
```json
{
  "prediction": "Spam",
  "is_spam": true,
  "confidence": 99.99,
  "spam_probability": 99.99,
  "ham_probability": 0.01,
  "keywords": ["claim", "prize", "000"],
  "detailed_keywords": [
    {
      "word": "claim",
      "category": "spam",
      "impact": "Spam Indicator",
      "score": 5.53,
      "tfidf": 0.284
    }
  ],
  "metadata": {
    "char_count": 81,
    "word_count": 13,
    "uppercase_ratio": 23.5,
    "has_url": false,
    "has_phone": true,
    "has_currency": true
  }
}
```

### `GET /api/history`
Returns historical predictions. Optional query params: `search`, `filter` (`all`, `spam`, `ham`), `limit`.

### `DELETE /api/history/<id>`
Deletes a specific history record by ID.

### `DELETE /api/history/clear`
Clears all history records.

### `GET /api/analytics`
Returns aggregate statistics for the dashboard and Chart.js graphs.

### `GET /api/model-info`
Returns ML architecture details, TF-IDF hyperparameter settings, and dataset benchmarks.

---

## 📜 License
MIT License. Built for educational and production demonstration purposes.
