from fastapi import FastAPI, HTTPException, Depends, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from textblob import TextBlob
import pandas as pd
import jwt
from datetime import datetime, timedelta
import io

app = FastAPI()

# CORS settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT settings
SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Mock user database
users_db = {
    "admin": {
        "username": "admin",
        "password": "admin123"
    }
}

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = users_db.get(form_data.username)
    if not user or form_data.password != user["password"]:
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    access_token = create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    return username

def analyze_sentiment(text):
    analysis = TextBlob(text)
    # Convert polarity to simple categories
    if analysis.sentiment.polarity > 0:
        return "positive"
    elif analysis.sentiment.polarity < 0:
        return "negative"
    return "neutral"

from pydantic import BaseModel

class TextRequest(BaseModel):
    text: str

@app.post("/analyze-text")
async def analyze_text(request: TextRequest, current_user: str = Depends(get_current_user)):
    if not request.text.trim() if hasattr(request.text, 'trim') else not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    analysis = TextBlob(request.text)
    polarity = analysis.sentiment.polarity
    subjectivity = analysis.sentiment.subjectivity
    
    if polarity > 0:
        sentiment = "positive"
    elif polarity < 0:
        sentiment = "negative"
    else:
        sentiment = "neutral"
        
    return {
        "text": request.text,
        "sentiment": sentiment,
        "polarity": round(polarity, 3),
        "subjectivity": round(subjectivity, 3)
    }

@app.post("/analyze")
async def analyze_file(file: UploadFile = File(...), current_user: str = Depends(get_current_user)):
    try:
        contents = await file.read()
        
        # Try decoding with utf-8-sig (handles UTF-8 with BOM), fallback to latin-1
        try:
            decoded_str = contents.decode('utf-8-sig').strip()
        except Exception:
            decoded_str = contents.decode('latin-1', errors='replace').strip()
            
        if not decoded_str:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        # Universal CSV reader: auto-detect delimiter (comma, semicolon, tab) and skip blank lines
        try:
            df = pd.read_csv(io.StringIO(decoded_str), skip_blank_lines=True, sep=None, engine='python')
        except Exception:
            # Fallback to standard comma reader
            df = pd.read_csv(io.StringIO(decoded_str), skip_blank_lines=True)

        if df.empty:
            raise HTTPException(status_code=400, detail="Uploaded CSV file contains no readable data.")

        # Normalize column headers (strip spaces & convert to lowercase)
        column_mapping = {str(col): str(col).strip().lower() for col in df.columns}
        df.rename(columns=column_mapping, inplace=True)

        # Detect text column (look for 'text', 'comment', 'review', 'sentence', 'feedback', 'message', 'content')
        text_col = None
        possible_text_cols = ['text', 'comment', 'review', 'sentence', 'feedback', 'message', 'payload', 'content']
        for col in possible_text_cols:
            if col in df.columns:
                text_col = col
                break
        
        if not text_col:
            # Fallback: pick the first string/object column
            for col in df.columns:
                if df[col].dtype == object:
                    text_col = col
                    break
        
        if not text_col and len(df.columns) > 0:
            text_col = df.columns[0]

        if not text_col:
            raise HTTPException(status_code=400, detail="Could not find a valid text column in the CSV file.")

        # Detect ID column or create sequence
        id_col = 'id' if 'id' in df.columns else None

        results = []
        for idx, row in df.iterrows():
            raw_text = str(row[text_col]) if pd.notna(row[text_col]) else ""
            if not raw_text.strip():
                continue
                
            sentiment = analyze_sentiment(raw_text)
            analysis = TextBlob(raw_text)
            
            row_id = str(row[id_col]) if (id_col and pd.notna(row[id_col])) else str(idx + 1)
            row_time = str(row['timestamp']) if ('timestamp' in df.columns and pd.notna(row['timestamp'])) else "N/A"

            results.append({
                'id': row_id,
                'text': raw_text,
                'sentiment': sentiment,
                'polarity': round(analysis.sentiment.polarity, 3),
                'timestamp': row_time
            })

        if not results:
            raise HTTPException(status_code=400, detail="No valid text entries found in the CSV file.")

        sentiment_counts = {
            'positive': len([r for r in results if r['sentiment'] == 'positive']),
            'negative': len([r for r in results if r['sentiment'] == 'negative']),
            'neutral': len([r for r in results if r['sentiment'] == 'neutral'])
        }

        return {
            'results': results,
            'statistics': sentiment_counts
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Failed to process CSV: {str(e)}")



