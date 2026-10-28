"""
Receipt Scam Scanner Module
Uses Gemini Vision API (gemini-2.5-flash) and Groq API (openai/gpt-oss-20b) to detect fake, manipulated, or spoofed transaction receipts.
Loads keys securely from environment variables (.env).
"""

import os
import json
import base64
import re
import requests
from PIL import Image
import io


def load_env_file():
    """Load key-value pairs from .env if present without exposing secrets in code."""
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        if k and not os.environ.get(k):
                            os.environ[k] = v
        except Exception:
            pass


load_env_file()


def get_gemini_key(user_key: str = None) -> str:
    """Retrieve Gemini key from argument, environment, or .env."""
    return (user_key or "").strip() or os.environ.get("GEMINI_API_KEY", "").strip()


def get_groq_key(user_key: str = None) -> str:
    """Retrieve Groq key from argument, environment, or .env."""
    return (user_key or "").strip() or os.environ.get("GROQ_API_KEY", "").strip()


SYSTEM_INSTRUCTION = """
You are an expert digital forensics examiner specializing in payment fraud detection, receipt forgery, and mobile banking spoof APK analysis.
Analyze this uploaded screenshot of a payment/transaction receipt.

Inspect the receipt for:
1. Font & Typography: Look for mismatched font styles, inconsistent font weights, uneven baseline alignment, or text pasted over existing backgrounds.
2. Layout & Visual Artifacts: Check for pixel distortion, blurriness around text while the rest is crisp, compression halos, missing or distorted bank/app logos.
3. Transaction Reference & Syntax: Validate reference number syntax (e.g., standard 12-digit UPI UTR, bank reference codes, PayPal/Stripe IDs). Check if the date/time matches the reference sequence if applicable.
4. Spoof App Signatures: Check for hallmarks of fake APKs (e.g., FakePay, Spoof Paytm, fake GPay, mock banking apps) which often miss genuine micro-details like bank account ending digits, legitimate QR code data, or proper UI margins.
5. Content Consistency: Verify whether the currency, amount words, and numbers align.

Return ONLY a valid JSON object with the following structure:
{
  "verdict": "SCAM" | "LEGITIMATE" | "SUSPICIOUS",
  "is_scam": true | false,
  "risk_score": <integer from 0 to 100, where 100 is definite fake/scam, 0 is clean>,
  "confidence": <integer from 50 to 99>,
  "summary": "<2-3 sentence overview of the forensic findings>",
  "engine_used": "<Engine name>",
  "extracted_details": {
    "app_or_bank": "<Detected app e.g. Google Pay, PhonePe, Paytm, PayPal, Chase, etc.>",
    "amount": "<Detected transaction amount with currency>",
    "payer": "<Sender name or account snippet if visible>",
    "payee": "<Receiver/Merchant name if visible>",
    "transaction_id": "<Extracted UTR/Reference number>",
    "timestamp": "<Extracted date and time>"
  },
  "forensic_checks": [
    {
      "check": "Font & Typography",
      "status": "PASS" | "FAIL" | "WARNING",
      "details": "<Observation about fonts, weights, and rendering>"
    },
    {
      "check": "Layout & Visual Artifacts",
      "status": "PASS" | "FAIL" | "WARNING",
      "details": "<Observation about pixel compression, alignment, and sharpness>"
    },
    {
      "check": "Transaction ID Syntax",
      "status": "PASS" | "FAIL" | "WARNING",
      "details": "<Observation about reference number length, format, and validity>"
    },
    {
      "check": "Timestamp Plausibility",
      "status": "PASS" | "FAIL" | "WARNING",
      "details": "<Observation regarding date and clock alignment>"
    },
    {
      "check": "Spoof App Hallmarks",
      "status": "PASS" | "FAIL" | "WARNING",
      "details": "<Observation regarding known fake payment generator patterns>"
    }
  ],
  "red_flags": [
    "<List of specific anomalies or suspicious cues discovered, or empty if authentic>"
  ],
  "recommendation": "<Direct advice for the user, e.g. Do not release goods, Verify bank statement directly, etc.>"
}
"""


def encode_image_base64(image_bytes: bytes) -> str:
    """Encode image bytes to base64 string."""
    return base64.b64encode(image_bytes).decode("utf-8")


def clean_json_response(raw_text: str) -> dict:
    """Extract and parse JSON from LLM response text."""
    raw_text = raw_text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw_text)
    if match:
        raw_text = match.group(1).strip()
    return json.loads(raw_text)


def analyze_with_gemini(image_bytes: bytes, mime_type: str, api_key: str = None) -> dict:
    """Perform visual receipt fraud analysis using Google Gemini multimodal vision (gemini-2.5-flash)."""
    key = get_gemini_key(api_key)
    if not key:
        raise ValueError("Google Gemini API Key is missing. Set GEMINI_API_KEY in .env or provide via UI.")

    models_to_try = ["gemini-2.5-flash", "gemini-flash-latest"]
    last_error = None

    base64_img = encode_image_base64(image_bytes)
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": SYSTEM_INSTRUCTION},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": base64_img,
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.1,
        },
    }
    headers = {"Content-Type": "application/json"}

    for model_name in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={key}"
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            if response.status_code == 200:
                data = response.json()
                candidates = data.get("candidates", [])
                if candidates:
                    text_content = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
                    result = clean_json_response(text_content)
                    result["engine_used"] = f"Google Gemini ({model_name})"
                    return result
            else:
                last_error = response.text
        except Exception as e:
            last_error = str(e)

    raise RuntimeError(f"Gemini API Error: {last_error}")


def analyze_with_groq_reasoning(gemini_data: dict, api_key: str = None) -> dict:
    """Use Groq API (openai/gpt-oss-20b) to cross-verify forensic findings and calculate fraud risk."""
    key = get_groq_key(api_key)
    if not key:
        return gemini_data

    from groq import Groq

    client = Groq(api_key=key)
    prompt = f"""
You are a senior financial fraud analyst. Cross-examine the following initial visual forensic report extracted from a payment receipt screenshot:

{json.dumps(gemini_data, indent=2)}

Task:
1. Verify if the extracted reference number / UTR format, amount, and spoof hallmarks indicate an authentic transaction or an offline spoof APK / Photoshop scam.
2. Provide a second-opinion risk score (0-100) and identify any additional banking fraud vectors.
3. Return ONLY a valid JSON object matching this schema:
{{
  "groq_risk_score": <int 0-100>,
  "groq_verdict": "SCAM" | "LEGITIMATE" | "SUSPICIOUS",
  "groq_analysis": "<2 sentence fraud validation>",
  "additional_red_flags": ["<extra flags if any>"]
}}
"""
    try:
        chat = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        groq_resp = json.loads(chat.choices[0].message.content)
        return groq_resp
    except Exception:
        return {}


def analyze_with_dual_consensus(image_bytes: bytes, mime_type: str, gemini_key: str = None, groq_key: str = None) -> dict:
    """Ensemble verification: Gemini Vision extracts visual forensics, Groq cross-validates payment protocols."""
    gkey = get_gemini_key(gemini_key)
    qkey = get_groq_key(groq_key)

    # 1. Run Gemini Vision
    gemini_result = analyze_with_gemini(image_bytes, mime_type, gkey)

    # 2. Run Groq Cross-Validation
    groq_result = analyze_with_groq_reasoning(gemini_result, qkey)

    if groq_result:
        groq_risk = groq_result.get("groq_risk_score", gemini_result["risk_score"])
        combined_risk = round((gemini_result["risk_score"] * 0.6) + (groq_risk * 0.4))
        
        # Combine flags
        combined_flags = list(dict.fromkeys(gemini_result.get("red_flags", []) + groq_result.get("additional_red_flags", [])))
        
        verdict = "SCAM" if combined_risk >= 70 else ("SUSPICIOUS" if combined_risk >= 40 else "LEGITIMATE")

        gemini_result["verdict"] = verdict
        gemini_result["is_scam"] = combined_risk >= 50
        gemini_result["risk_score"] = combined_risk
        gemini_result["engine_used"] = "Dual AI Consensus (Gemini 2.5 Flash Vision + Groq GPT-OSS)"
        gemini_result["red_flags"] = combined_flags
        if groq_result.get("groq_analysis"):
            gemini_result["summary"] += f" | Groq Cross-Verification: {groq_result['groq_analysis']}"

    return gemini_result


def analyze_with_heuristic_demo(image_bytes: bytes, filename: str) -> dict:
    """Fallback intelligent forensic demo analyzer for offline testing."""
    fname = (filename or "").lower()
    is_fake_sample = "fake" in fname or "spoof" in fname or "scam" in fname

    if is_fake_sample:
        return {
            "verdict": "SCAM",
            "is_scam": True,
            "risk_score": 94,
            "confidence": 96,
            "summary": "Forensic scan detected high-probability synthetic receipt manipulation. Typographical inconsistency on transaction amount and non-standard reference number format characteristic of fake payment APK generators.",
            "engine_used": "Offline Forensic Heuristic (Demo Mode)",
            "extracted_details": {
                "app_or_bank": "UPI / Payment Spoof Generator",
                "amount": "Rs. 15,000.00",
                "payer": "Unverified Device Account",
                "payee": "Alex Electronics",
                "transaction_id": "998822 (Invalid Short Syntax)",
                "timestamp": "28 Oct 2026, 15:45",
            },
            "forensic_checks": [
                {
                    "check": "Font & Typography",
                    "status": "FAIL",
                    "details": "Irregular font kerning and artificial weight variation detected in amount digits.",
                },
                {
                    "check": "Layout & Visual Artifacts",
                    "status": "FAIL",
                    "details": "Uneven border spacing and unnatural box rendering typical of fake mock APKs.",
                },
                {
                    "check": "Transaction ID Syntax",
                    "status": "FAIL",
                    "details": "Identifier is only 6 digits. Standard UPI banking protocols mandate a 12-digit UTR.",
                },
                {
                    "check": "Timestamp Plausibility",
                    "status": "WARNING",
                    "details": "Static time indicator lacks standard system status bar sync.",
                },
                {
                    "check": "Spoof App Hallmarks",
                    "status": "FAIL",
                    "details": "Layout matches known 'Paytm/GPay Spoof Prank' Android app templates.",
                },
            ],
            "red_flags": [
                "Invalid 6-digit transaction ID instead of official 12-digit UPI UTR",
                "Mismatched typography on currency value indicating digital modification",
                "Synthetic layout matching signature of offline payment simulator app",
            ],
            "recommendation": "CRITICAL RISK: Do NOT hand over goods or services based on this receipt screenshot. Verify incoming credit directly within your authenticated mobile banking application.",
        }
    else:
        return {
            "verdict": "LEGITIMATE",
            "is_scam": False,
            "risk_score": 8,
            "confidence": 92,
            "summary": "Receipt appears authentic with consistent typography, genuine vector icons, authentic 12-digit UTR bank reference number, and proper application layout hierarchy.",
            "engine_used": "Offline Forensic Heuristic (Demo Mode)",
            "extracted_details": {
                "app_or_bank": "Google Pay / Verified UPI",
                "amount": "Rs. 1,420.00",
                "payer": "HDFC Bank (Account ending 4102)",
                "payee": "Fresh Supermarket",
                "transaction_id": "429810452391 (Valid 12-digit UTR)",
                "timestamp": "28 Oct 2026, 12:14:02 PM",
            },
            "forensic_checks": [
                {
                    "check": "Font & Typography",
                    "status": "PASS",
                    "details": "Standardized banking typeface, uniform glyph anti-aliasing, and clean rendering.",
                },
                {
                    "check": "Layout & Visual Artifacts",
                    "status": "PASS",
                    "details": "Natural native mobile screenshot margins with authentic interface layout.",
                },
                {
                    "check": "Transaction ID Syntax",
                    "status": "PASS",
                    "details": "Valid 12-digit UTR sequence conforming to National Payments Corporation standards.",
                },
                {
                    "check": "Timestamp Plausibility",
                    "status": "PASS",
                    "details": "Plausible time stamp formatting and proper date structure.",
                },
                {
                    "check": "Spoof App Hallmarks",
                    "status": "PASS",
                    "details": "No indicators of fake APK or template generation found.",
                },
            ],
            "red_flags": [],
            "recommendation": "Receipt indicators are consistent with legitimate payment confirmations. As standard precaution, always reconcile against your merchant or bank account statement.",
        }
