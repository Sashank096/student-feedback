from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ml_pipeline import analyze_feedback
import uvicorn

app = FastAPI(title="Campus Feedback Analyzer ML API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class FeedbackRequest(BaseModel):
    text: str
    subject: str = ""

class BatchFeedbackRequest(BaseModel):
    feedbacks: list[dict]

@app.get("/")
def root():
    return {"status": "Campus Feedback Analyzer ML API is running"}

@app.post("/analyze")
def analyze(req: FeedbackRequest):
    try:
        result = analyze_feedback(req.text, req.subject)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-batch")
def analyze_batch(req: BatchFeedbackRequest):
    try:
        results = []
        for fb in req.feedbacks:
            text = fb.get("text", "")
            subject = fb.get("subject", "")
            result = analyze_feedback(text, subject)
            result["id"] = fb.get("id")
            results.append(result)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
