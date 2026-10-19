import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

import io
import re
import json
import torch
import numpy as np
import joblib
from PIL import Image
import pytesseract

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sklearn.metrics.pairwise import cosine_similarity
from transformers import AutoTokenizer, AutoModel

# ---------------------------------------------------------------------------
# Set Tesseract Windows path if installed at standard location
# ---------------------------------------------------------------------------
standard_tesseract_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
if os.path.exists(standard_tesseract_path):
    pytesseract.pytesseract.tesseract_cmd = standard_tesseract_path

# ---------------------------------------------------------------------------
# 1. Initialize FastAPI Application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AI-Powered FIR Analysis Microservice",
    description="Provides OCR text digitization, BERT Summarization, and BNS Section Prediction.",
    version="1.2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# 2. Load AI Models on Startup
# ---------------------------------------------------------------------------
print("⏳ Loading BERT Model & Tokenizer (bert-base-uncased)...")
tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
bert_model = AutoModel.from_pretrained("bert-base-uncased")

print("⏳ Loading Random Forest BNS Classifier & TF-IDF Vectorizer...")
rf_model = joblib.load("rf_bns_model.joblib")
tfidf_vec = joblib.load("tfidf_vectorizer.joblib")

print("✅ All AI models successfully loaded and ready for inference!")

# ---------------------------------------------------------------------------
# 3. Helper Functions: Summarization, Classification & Details
# ---------------------------------------------------------------------------

def get_sentence_embedding(sentence: str):
    inputs = tokenizer(sentence, return_tensors="pt", padding=True, truncation=True, max_length=128)
    with torch.no_grad():
        outputs = bert_model(**inputs)
    return outputs.last_hidden_state.mean(dim=1).squeeze().numpy()

def bert_summarize(text: str, num_sentences: int = 2) -> str:
    sentences = [s.strip() for s in re.split(r'(?<=[.!?]) +', text) if len(s.strip()) > 5]
    if len(sentences) <= num_sentences:
        return text

    embeddings = [get_sentence_embedding(s) for s in sentences]
    doc_embedding = np.mean(embeddings, axis=0)
    scores = [cosine_similarity([emb], [doc_embedding])[0][0] for emb in embeddings]
    
    top_indices = np.argsort(scores)[-num_sentences:]
    top_indices.sort()
    return " ".join([sentences[i] for i in top_indices])

def predict_bns(text: str):
    vec = tfidf_vec.transform([text])
    pred_section = rf_model.predict(vec)[0]
    probs = rf_model.predict_proba(vec)[0]
    confidence = float(np.max(probs) * 100)
    return pred_section, round(confidence, 2)

def extract_incident_details(text: str):
    dates = re.findall(r'\b(?:\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b', text, re.IGNORECASE)
    times = re.findall(r'\b(?:\d{1,2}:\d{2}\s*(?:AM|PM|hrs|hours)?|\d{1,2}\s*(?:AM|PM))\b', text, re.IGNORECASE)
    amounts = re.findall(r'(?:Rs\.?|INR|₹)\s*[\d,]+', text, re.IGNORECASE)
    weapons = [w for w in ['knife', 'stick', 'wooden stick', 'iron rod', 'gun', 'pistol', 'sharp weapon'] if re.search(r'\b' + w + r'\b', text, re.IGNORECASE)]
    vehicles = [v for v in ['motorcycle', 'bike', 'pulsar', 'scooter', 'activa', 'car', 'swift', 'auto'] if re.search(r'\b' + v + r'\b', text, re.IGNORECASE)]

    return {
        "dates_mentioned": list(set(dates)) if dates else ["Not specified"],
        "times_mentioned": list(set(times)) if times else ["Not specified"],
        "monetary_loss": list(set(amounts)) if amounts else ["None reported"],
        "weapons_detected": list(set(weapons)) if weapons else ["None recorded"],
        "vehicles_involved": list(set(vehicles)) if vehicles else ["None recorded"]
    }

# ---------------------------------------------------------------------------
# 4. API Schemas
# ---------------------------------------------------------------------------
class FIRAnalysisRequest(BaseModel):
    text: str = Field(..., min_length=20, description="Raw text of the FIR.")
    num_sentences: int = Field(default=2, ge=1, le=5)

class FIRAnalysisResponse(BaseModel):
    extracted_ocr_text: str | None = None
    summary: str
    predicted_bns_section: str
    confidence_score: float
    key_incident_details: dict

# ---------------------------------------------------------------------------
# 5. Endpoints
# ---------------------------------------------------------------------------

@app.get("/")
def health_check():
    return {"status": "online", "message": "FIR Analysis AI Microservice is running!"}

# --- ENDPOINT 1: Text Analysis ---
@app.post("/analyze", response_model=FIRAnalysisResponse)
def analyze_fir_text(request: FIRAnalysisRequest):
    try:
        raw_text = request.text.strip()
        summary = bert_summarize(raw_text, num_sentences=request.num_sentences)
        
        # Matches training pipeline: evaluate full complaint + summary
        bns_section, confidence = predict_bns(raw_text + " " + summary)
        details = extract_incident_details(raw_text)
        
        return FIRAnalysisResponse(
            extracted_ocr_text=None,
            summary=summary,
            predicted_bns_section=bns_section,
            confidence_score=confidence,
            key_incident_details=details
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text analysis failed: {str(e)}")

# --- ENDPOINT 2: Image OCR + Full AI Analysis ---
@app.post("/analyze-image", response_model=FIRAnalysisResponse)
async def analyze_fir_image(
    file: UploadFile = File(..., description="Scanned FIR document image (JPG, PNG, TIFF)"),
    num_sentences: int = Form(default=2)
):
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        extracted_text = pytesseract.image_to_string(image).strip()
        
        if len(extracted_text) < 15:
            raise HTTPException(
                status_code=400, 
                detail="OCR was unable to extract legible text from this image. Please upload a clearer scan."
            )
        
        summary = bert_summarize(extracted_text, num_sentences=num_sentences)
        bns_section, confidence = predict_bns(extracted_text + " " + summary)
        details = extract_incident_details(extracted_text)
        
        return FIRAnalysisResponse(
            extracted_ocr_text=extracted_text,
            summary=summary,
            predicted_bns_section=bns_section,
            confidence_score=confidence,
            key_incident_details=details
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image OCR processing failed: {str(e)}")