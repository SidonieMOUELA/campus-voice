from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from dotenv import load_dotenv
from models import Base, User, Signalement, Note
from pydantic import BaseModel
from typing import Optional
import os

load_dotenv()

# --- Config ---
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))
DATABASE_URL = os.getenv("DATABASE_URL")

# --- Base de données ---
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

# --- App ---
app = FastAPI(title="CampusVoice API", version="1.0.0")

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# --- Schémas Pydantic ---
class SignalementCreate(BaseModel):
    titre: str
    description: str
    categorie: str

class SignalementUpdate(BaseModel):
    statut: Optional[str] = None

# --- Dépendance DB ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Utilitaires JWT ---
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def hash_password(password):
    return pwd_context.hash(password[:72])

# --- Routes de base ---
@app.get("/")
def root():
    return {"message": "CampusVoice API is running 🚀"}

# --- Register ---
@app.post("/register")
def register(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == form_data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    user = User(
        nom="Nouvel",
        prenom="Utilisateur",
        email=form_data.username,
        mot_de_passe=hash_password(form_data.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "Compte créé ✅", "email": user.email}

# --- Login ---
@app.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.mot_de_passe):
        raise HTTPException(status_code=401, detail="Identifiants incorrects")
    token = create_access_token(data={"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}

# --- Me ---
@app.get("/me")
def get_me(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        user = db.query(User).filter(User.email == email).first()
        return {"email": user.email, "nom": user.nom, "role": user.role}
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide")

# --- Signalements ---
@app.post("/signalements")
def create_signalement(data: SignalementCreate, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        user = db.query(User).filter(User.email == email).first()
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide")
    signalement = Signalement(
        titre=data.titre,
        description=data.description,
        categorie=data.categorie,
        user_id=user.id
    )
    db.add(signalement)
    db.commit()
    db.refresh(signalement)
    return signalement

@app.get("/signalements")
def get_signalements(categorie: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Signalement)
    if categorie:
        query = query.filter(Signalement.categorie == categorie)
    return query.order_by(Signalement.score_ia.desc()).all()

@app.post("/signalements/{id}/like")
def like_signalement(id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide")
    s = db.query(Signalement).filter(Signalement.id == id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Signalement introuvable")
    s.likes += 1
    age_jours = (datetime.utcnow() - s.created_at).days + 1
    s.score_ia = round((s.likes * 2) / age_jours, 2)
    db.commit()
    db.refresh(s)
    return {"score_ia": s.score_ia, "likes": s.likes}

@app.patch("/signalements/{id}/statut")
def update_statut(id: int, data: SignalementUpdate, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        user = db.query(User).filter(User.email == email).first()
        if user.role != "admin":
            raise HTTPException(status_code=403, detail="Accès refusé")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide")
    s = db.query(Signalement).filter(Signalement.id == id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Signalement introuvable")
    s.statut = data.statut
    db.commit()
    db.refresh(s)
    return s