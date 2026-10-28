# 🛡️ AI Spam & Receipt Scam Detector

An end-to-end AI security platform that combines **NLP Machine Learning** to classify SMS messages and **Multimodal Computer Vision (Google Gemini & Groq API)** to detect fake, forged, or spoofed transaction receipts.

Built with **Python Flask**, **Scikit-learn**, **TF-IDF**, **Multinomial Naive Bayes**, **Google Gemini 1.5 Flash Vision**, and **Groq Llama-3.2 Vision**, featuring a glassmorphic dashboard ready for deployment on **Render**.

---

## 🌟 Major Modules & Components

### 1. 📱 SMS Spam Message Detector
- **NLP Prediction Engine**: Uses `TfidfVectorizer` (unigrams + bigrams) and `MultinomialNB` trained on the canonical **UCI SMS Spam Collection** (5,572 messages) achieving **98.21% accuracy** and **97.78% spam precision**.
- **Dual Probability Meter**: Real-time confidence bars showing both Spam % and Ham %.
- **Keyword Explainability**: Ranks influential vocabulary that drove the classification.
- **Message Input Interface**: Character/word counters, <kbd>Ctrl</kbd> + <kbd>Enter</kbd> shortcut, and 6 one-click test sample pills.
- **Analysis History**: Stored in SQLite with search, category filtering, deletion, and CSV export.
- **Visual Analytics**: Interactive Chart.js charts for spam distribution, confidence levels, and activity trends.

### 2. 🧾 Transaction Receipt Scam Scanner (Gemini & Groq)
- **Multimodal Image Upload**: Drag-and-drop or select any transaction receipt screenshot (UPI, GPay, Paytm, PhonePe, PayPal, Bank Transfer).
- **Dual AI Engine Options**:
  - **Dual AI Consensus (Gemini + Groq)**: Runs Gemini Vision forensic analysis and cross-validates with Groq fraud reasoning.
  - **Google Gemini 1.5 Flash Vision**: Detects typographical anomalies, digital manipulation, and layout artifacts.
  - **Groq Vision (Llama-3.2-11B)**: Fast open-weights multimodal inspection.
  - **Auto / Heuristic Demo Mode**: Built-in forensic inspector for instant testing without API keys.
- **Forensic Verification Matrix**:
  - *Font & Typography*: Detects mismatched fonts, uneven kerning, and altered currency numbers.
  - *Layout & Visual Artifacts*: Identifies pixel halos, compression artifacts, and missing anti-aliasing.
  - *Transaction ID Syntax*: Validates reference codes (e.g. 12-digit Indian UPI UTR syntax).
  - *Spoof App Hallmarks*: Flags signatures of known offline APK payment spoofers (Paytm Spoof, FakePay).
- **Extracted Information**: App/Bank, Transaction Amount, Payer, Payee, Reference ID, and Timestamp.
- **Pre-Loaded Test Samples**: One-click test pills for *Sample Fake Spoof Receipt* and *Sample Authentic Bank Receipt*.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, CSS3 (Glassmorphism & Responsive Design), JavaScript (ES6+), Chart.js 4, FontAwesome 6 |
| **Backend** | Python Flask, Gunicorn |
| **SMS Machine Learning** | Scikit-learn (TfidfVectorizer, MultinomialNB), Joblib, NumPy, Pandas |
| **Vision & Reasoning AI** | Google Gemini 1.5 Flash Vision, Groq API (Llama-3.2-11B-Vision) |
| **Database** | SQLite (Zero-configuration persistent SQL database) |
| **Hosting & Cloud** | Render Web Service (`render.yaml`, `Procfile`) |

---

## 📁 Project Structure

```
AI project/
├── app.py                      # Flask backend & RESTful API routes
├── database.py                 # SQLite database models, queries, and starter seeds
├── model_trainer.py            # ML pipeline: TF-IDF + Multinomial Naive Bayes training
├── receipt_scanner.py          # Multimodal Gemini & Groq Vision receipt fraud engine
├── tests.py                    # Automated test suite (all 8 tests passed)
├── requirements.txt            # Python dependencies for Render & local
├── Procfile                    # Render / Gunicorn web process definition
├── render.yaml                 # Render Blueprint Infrastructure-as-Code
├── .gitignore                  # Git exclusions (venv, caches, etc.)
├── README.md                   # Complete documentation
├── data/
│   └── sms_spam_collection.csv # 5,572 labeled SMS messages
├── models/
│   ├── spam_model.joblib       # Trained MultinomialNB classifier
│   ├── vectorizer.joblib       # Fitted TfidfVectorizer
│   └── model_metrics.json      # Evaluation metrics & top keywords
├── static/
│   ├── css/
│   │   └── style.css           # Glassmorphism dark UI styling
│   ├── js/
│   │   └── main.js             # AJAX client logic, Chart.js graphs, tabs, and drag-and-drop
│   └── images/
│       ├── sample_fake_receipt.png  # Pre-loaded fake spoof receipt for testing
│       └── sample_real_receipt.png  # Pre-loaded authentic bank receipt for testing
└── templates/
    └── index.html              # Main single-page application dashboard
```

---

## 🚀 Running Locally

### 1. Activate the Virtual Environment
```powershell
.\venv\Scripts\activate
```

### 2. Run Automated Tests
```powershell
python tests.py
```

### 3. (Optional) Set API Keys
You can either paste your API keys in the web UI settings box or set them in your environment:
```powershell
$env:GEMINI_API_KEY="your-gemini-key"
$env:GROQ_API_KEY="your-groq-key"
```

### 4. Start the Application
```powershell
python app.py
```
Open **`http://localhost:5000`** in your browser.

---

## 🌐 Deploying to Render

This codebase is pre-configured for free deployment on **Render**:

1. Push your changes to GitHub:
   ```bash
   git add .
   git commit -m "Add Transaction Receipt Scam Scanner with Gemini & Groq"
   git push origin main
   ```
2. In your Render Dashboard, select your `ai-spam-detector` service.
3. (Optional) Under **Environment Variables**, you can add:
   - `GEMINI_API_KEY` : Your Google AI Studio key
   - `GROQ_API_KEY` : Your Groq Console key
4. Render will auto-deploy the updated code!
