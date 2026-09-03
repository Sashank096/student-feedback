import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from ml_pipeline import analyze_feedback
import uvicorn

load_dotenv()

app = FastAPI(title="Campus Feedback Analyzer ML API")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv(
    "FRONTEND_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,https://frontend-ten-snowy-84.vercel.app",
).split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class FeedbackRequest(BaseModel):
    text: str = ""
    subject: str = ""

class BatchFeedbackRequest(BaseModel):
    feedbacks: list[dict]


def require_user(authorization: str | None) -> dict:
    """Validate the Supabase access token without exposing service credentials."""
    if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY or not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication is required.")

    request = Request(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={
            "apikey": SUPABASE_PUBLISHABLE_KEY,
            "Authorization": authorization,
        },
    )
    try:
        with urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        raise HTTPException(status_code=401, detail="Authentication is invalid or expired.")

@app.get("/")
def root():
    return {"status": "Campus Feedback Analyzer ML API is running"}

@app.post("/analyze")
def analyze(req: FeedbackRequest, authorization: str | None = Header(default=None)):
    require_user(authorization)
    if len(req.text.strip()) < 5:
        raise HTTPException(status_code=422, detail="Feedback must contain at least 5 characters.")
    try:
        result = analyze_feedback(req.text, req.subject)
        return result
    except Exception:
        raise HTTPException(status_code=503, detail="The feedback analysis service is temporarily unavailable.")

@app.post("/analyze-batch")
def analyze_batch(req: BatchFeedbackRequest, authorization: str | None = Header(default=None)):
    require_user(authorization)
    try:
        results = []
        for fb in req.feedbacks:
            text = fb.get("text", "")
            if len(text.strip()) < 5:
                continue
            subject = fb.get("subject", "")
            result = analyze_feedback(text, subject)
            result["id"] = fb.get("id")
            results.append(result)
        return {"results": results}
    except Exception:
        raise HTTPException(status_code=503, detail="The feedback analysis service is temporarily unavailable.")

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
