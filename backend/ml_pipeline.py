"""
ML Pipeline for Campus Feedback Analyzer
-----------------------------------------
Stage 1: Text Preprocessing (NLTK)
Stage 2: Sentiment Analysis (DistilBERT Multilingual)
Stage 3: Aspect/Topic Detection (Keyword + TF-IDF)
Stage 4: Priority Scoring (rule-based on sentiment + aspect)
"""

import re
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from transformers import pipeline
import numpy as np

# Download NLTK data on first run
try:
    nltk.data.find("tokenizers/punkt")
except LookupError:
    nltk.download("punkt", quiet=True)
    nltk.download("stopwords", quiet=True)
    nltk.download("punkt_tab", quiet=True)

# ─────────────────────────────────────────────
# Load DistilBERT Multilingual Sentiment Model
# Supports English + Telugu (via multilingual BERT)
# ─────────────────────────────────────────────
print("Loading sentiment model...")
sentiment_model = pipeline(
    "sentiment-analysis",
    model="lxyuan/distilbert-base-multilingual-cased-sentiments-student",
    top_k=None,      # get all 3 scores
    truncation=True,
    max_length=512,
)
print("Model loaded!")

# ─────────────────────────────────────────────
# Aspect Keywords (English + Telugu transliteration)
# ─────────────────────────────────────────────
ASPECT_KEYWORDS = {
    "Teaching": [
        "teacher", "faculty", "professor", "lecture", "explain", "teaching",
        "class", "subject", "notes", "sir", "madam", "doubt", "understand",
        "boring", "interesting", "syllabus", "curriculum", "lesson",
        # Telugu transliteration
        "adhyapakudu", "paatha", "vidya", "upanyasam"
    ],
    "Labs": [
        "lab", "laboratory", "equipment", "computer", "experiment", "practical",
        "machine", "instrument", "software", "hardware", "broken", "working",
        "tool", "device", "system", "pc",
        # Telugu
        "prayogasala", "yantralu"
    ],
    "Infrastructure": [
        "wifi", "wi-fi", "internet", "network", "connectivity", "building",
        "classroom", "bench", "chair", "fan", "ac", "light", "power",
        "electricity", "projector", "board", "washroom", "toilet", "parking",
        # Telugu
        "mandiram", "internet", "vidyut"
    ],
    "Canteen": [
        "canteen", "food", "mess", "lunch", "breakfast", "dinner", "meal",
        "taste", "quality", "hygiene", "clean", "dirty", "price", "cost",
        "water", "drink", "cafeteria", "eat",
        # Telugu
        "aaharam", "bhojanam", "canteen"
    ],
    "Exams": [
        "exam", "examination", "test", "marks", "grade", "result", "paper",
        "question", "answer", "hall ticket", "schedule", "timetable", "marks",
        "pass", "fail", "score", "assessment", "assignment",
        # Telugu
        "pariksha", "markulu", "result"
    ],
    "Library": [
        "library", "book", "reference", "study", "reading", "journal",
        "resource", "material", "digital", "online", "access",
        # Telugu
        "granthalayam", "pustakam"
    ],
}

# ─────────────────────────────────────────────
# Stage 1: Text Preprocessing
# ─────────────────────────────────────────────
def preprocess_text(text: str) -> str:
    """Clean and normalize feedback text."""
    # Lowercase
    text = text.lower().strip()
    # Remove special characters but keep Telugu Unicode
    text = re.sub(r"[^\w\s\u0C00-\u0C7F]", " ", text)
    # Remove extra spaces
    text = re.sub(r"\s+", " ", text).strip()
    return text

# ─────────────────────────────────────────────
# Stage 2: Sentiment Analysis (DistilBERT)
# ─────────────────────────────────────────────
def get_sentiment(text: str) -> dict:
    """
    Returns sentiment: positive / neutral / negative
    with confidence scores for all 3 classes.
    """
    if not text or len(text.strip()) < 3:
        return {
            "sentiment": "neutral",
            "confidence": 1.0,
            "scores": {"positive": 0.33, "neutral": 0.34, "negative": 0.33}
        }

    results = sentiment_model(text[:512])[0]  # truncate to 512 tokens

    # Map model output to our labels
    scores = {}
    for item in results:
        label = item["label"].lower()
        if "pos" in label:
            scores["positive"] = round(item["score"], 4)
        elif "neg" in label:
            scores["negative"] = round(item["score"], 4)
        else:
            scores["neutral"] = round(item["score"], 4)

    # Fill missing
    scores.setdefault("positive", 0.0)
    scores.setdefault("neutral", 0.0)
    scores.setdefault("negative", 0.0)

    # Dominant sentiment
    dominant = max(scores, key=scores.get)
    confidence = scores[dominant]

    return {
        "sentiment": dominant,
        "confidence": confidence,
        "scores": scores,
    }

# ─────────────────────────────────────────────
# Stage 3: Aspect / Topic Detection
# ─────────────────────────────────────────────
def detect_aspect(text: str, subject_hint: str = "") -> str:
    """
    Detects which campus area the feedback is about.
    Uses keyword matching across all aspects.
    """
    text_lower = text.lower()
    aspect_scores = {}

    for aspect, keywords in ASPECT_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > 0:
            aspect_scores[aspect] = score

    # If subject hint provided, boost that aspect
    if subject_hint:
        hint_lower = subject_hint.lower()
        for aspect, keywords in ASPECT_KEYWORDS.items():
            if any(kw in hint_lower for kw in keywords):
                aspect_scores[aspect] = aspect_scores.get(aspect, 0) + 2

    if aspect_scores:
        return max(aspect_scores, key=aspect_scores.get)

    return "General"

# ─────────────────────────────────────────────
# Stage 4: Priority Scoring
# ─────────────────────────────────────────────
def calculate_priority(sentiment: str, confidence: float, text: str) -> str:
    """
    Assigns an operational priority from the model's sentiment signal plus
    urgency language in the original feedback. The student's wording is the
    only input; no rating or pre-selected category is required.
    """
    urgency_terms = {
        "urgent", "immediately", "unsafe", "danger", "dangerous", "broken",
        "not working", "cannot", "can't", "never", "worst", "serious",
        "emergency", "harassment", "threat", "fraud", "blocked", "failure",
        "failed", "unacceptable", "very poor"
    }
    lower = text.lower()
    urgency = sum(1 for term in urgency_terms if term in lower)

    if sentiment == "negative":
        if confidence >= 0.80 or urgency >= 2:
            return "High"
        return "Medium"
    if sentiment == "neutral":
        return "Medium" if urgency else "Low"
    return "Low"


# ─────────────────────────────────────────────
# Main Pipeline Entry Point
# ─────────────────────────────────────────────
def analyze_feedback(text: str, subject: str = "") -> dict:
    """
    Full ML pipeline:
    raw text → sentiment → topic detection → priority
    """
    # Stage 1: Preprocess
    cleaned = preprocess_text(text)

    # Stage 2: Sentiment (run on cleaned text)
    sentiment_result = get_sentiment(cleaned)

    # Stage 3: Aspect Detection
    aspect = detect_aspect(cleaned, "")

    # Stage 4: Priority
    priority = calculate_priority(
        sentiment_result["sentiment"],
        sentiment_result["confidence"],
        text
    )

    return {
        "original_text": text,
        "cleaned_text": cleaned,
        "sentiment": sentiment_result["sentiment"],       # positive/neutral/negative
        "confidence": sentiment_result["confidence"],     # 0.0 - 1.0
        "scores": sentiment_result["scores"],             # all 3 class scores
        "aspect": aspect,                                 # Teaching/Labs/etc.
        "priority": priority,                             # High/Medium/Low
        "pipeline_stages": [
            "text_preprocessing",
            "distilbert_sentiment",
            "keyword_aspect_detection",
            "rule_based_priority"
        ]
    }
