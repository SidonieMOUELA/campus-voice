"""
CampusVoice API v3.0
Auteurs :
  - Modibo : Backend & API (base)
  - Kenny  : IA Engine (Claude API + analyse sémantique, urgences, décisions stratégiques)
Hackathon AFI-TECH 2026
"""

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from dotenv import load_dotenv
from models import Base, User, Signalement, Note, Commentaire, Vote, Satisfaction, Salle, Seance, Info, InfoReaction, Notification
from pydantic import BaseModel, Field
from typing import Optional, List
import os, re, json, httpx

load_dotenv()

# ── Config ───────────────────────────────────────────────────────────────────
SECRET_KEY                  = os.getenv("SECRET_KEY", "campus_voice_secret_key_2026")
ALGORITHM                   = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))
DATABASE_URL                = os.getenv("DATABASE_URL")
GROQ_API_KEY                = os.getenv("GROQ_API_KEY", "")   # Gratuit sur console.groq.com

# ── DB ───────────────────────────────────────────────────────────────────────
engine       = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="CampusVoice API", version="3.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

pwd_context   = CryptContext(schemes=["sha256_crypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  RÉFÉRENTIELS ÉCOLE AFI                                                  ║
# ╚══════════════════════════════════════════════════════════════════════════╝

FILIERES = {
    "BAF":  "Banque Assurance Finance",
    "QHSE": "Qualité Hygiène Sécurité Environnement",
    "DEV":  "Développement Web",
    "SRT":  "Systèmes Réseaux et Télécommunications",
    "MMC":  "Marketing Management et Communication",
    "MJF":  "Management Juridique et Fiscal",
    "GRH":  "Gestion des Ressources Humaines",
    "MAI":  "Management des Affaires Internationales",
    "TL":   "Transport et Logistique",
    "GSE":  "Gestion et Stratégie d'Entreprise",
    "IJF":  "Ingénieur Juridique et Fiscal",
    "GFCE": "Gestion Financière, Fiscale et Comptable des Entreprises",
    "GFAE": "Gestion Finance",
}

NIVEAUX = {
    "L1": "Licence 1",
    "L2": "Licence 2",
    "L3": "Licence 3",
    "M1": "Master 1",
    "M2": "Master 2",
}

def _gen_classe(filiere_code: str, niveau_code: str) -> str:
    """Génère automatiquement la classe : ex. M2-SRT, L3-DEV"""
    fc = filiere_code.strip().upper()
    nc = niveau_code.strip().upper()
    return f"{nc}-{fc}"

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  SCHÉMAS PYDANTIC                                                        ║
# ╚══════════════════════════════════════════════════════════════════════════╝

class UserRegister(BaseModel):
    matricule:    str
    mot_de_passe: str
    nom:          str
    prenom:       str
    email:        Optional[str] = None
    filiere:      Optional[str] = None   # code court : BAF, SRT, DEV…
    niveau:       Optional[str] = None   # code court : L1, L2, L3, M1, M2

class SignalementCreate(BaseModel):
    titre: str
    description: str
    categorie: Optional[str] = None
    localisation: Optional[str] = None
    type_publication: Optional[str] = "public"
    anonyme: Optional[bool] = False
    visibilite: Optional[str] = "tous"   # tous | filiere | admin

class SignalementUpdate(BaseModel):
    statut: Optional[str] = None

class NoteCreate(BaseModel):
    matiere: str
    note: float = Field(..., ge=0, le=20)
    semestre: str

class CommentaireCreate(BaseModel):
    contenu: str

class SatisfactionCreate(BaseModel):
    note_satisfaction: int = Field(..., ge=1, le=5)
    avis: Optional[str] = None

class SalleCreate(BaseModel):
    site:     str   # AFI_SIEGE | AFITECH | AFIPOINT_E | LYCEE
    nom:      str
    capacite: int = 30

class SeanceUpdate(BaseModel):
    ue:      Optional[str]   = None
    module:  Optional[str]   = None
    prof:    Optional[str]   = None
    date:    Optional[str]   = None
    heure:   Optional[str]   = None
    duree:   Optional[float] = None
    statut:  Optional[str]   = None   # programme|annule|reporte|en_ligne
    note:    Optional[str]   = None   # motif / info

class InfoCreate(BaseModel):
    titre:          str
    description:    Optional[str] = None
    lien:           Optional[str] = None
    date_evenement: Optional[str] = None
    cible:          Optional[str] = "tous"   # tous | <filiere> | site_<SITE>

class ReactionCreate(BaseModel):
    emoji: str   # 👍 ❤️ 😂 😮 😢 👏

class RoleUpdate(BaseModel):
    role: str

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  UTILITAIRES AUTH                                                        ║
# ╚══════════════════════════════════════════════════════════════════════════╝

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_access_token(data: dict):
    to_encode = data.copy()
    to_encode["exp"] = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_password(plain, hashed): return pwd_context.verify(plain, hashed)
def hash_password(pw): return pwd_context.hash(pw[:72])

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    try:
        payload   = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        matricule = payload.get("sub")
        if not matricule:
            raise HTTPException(status_code=401, detail="Token invalide")
        user = db.query(User).filter(User.matricule == matricule).first()
        if not user:
            raise HTTPException(status_code=401, detail="Utilisateur introuvable")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide")

# ── Rôles & gardes ───────────────────────────────────────────────────────────
ROLES_ADMIN        = {"admin", "admin_general"}
ROLES_VOIR_ANONYME = {"admin_general"}
ROLES_DASHBOARD    = {"admin_general"}

def _check_suspendu(u: User):
    if u.suspendu:
        raise HTTPException(403, "Compte suspendu. Contactez l'administration.")

def get_current_active_user(u: User = Depends(get_current_user)) -> User:
    _check_suspendu(u); return u

def require_admin(u: User = Depends(get_current_user)) -> User:
    _check_suspendu(u)
    if u.role not in ROLES_ADMIN:
        raise HTTPException(403, "Accès réservé aux administrateurs")
    return u

def require_admin_general(u: User = Depends(get_current_user)) -> User:
    _check_suspendu(u)
    if u.role not in ROLES_DASHBOARD:
        raise HTTPException(403, "Accès réservé à l'administrateur général")
    return u

def _xp(user: User, pts: int, db: Session):
    user.xp = (user.xp or 0) + pts
    badges   = set((user.badges or "").split(",")) - {""}
    if user.xp >= 10:  badges.add("etudiant_actif")
    if user.xp >= 50:  badges.add("super_contributeur")
    if user.xp >= 100: badges.add("protecteur_du_campus")
    user.badges = ",".join(badges)
    db.commit()

def _notifier(db: Session, user_ids: list, type_: str, titre: str, message: str,
               ref_id: int = None, ref_type: str = None):
    """Crée une notification en base pour chaque user_id de la liste."""
    for uid in set(user_ids):  # dédoublonner
        notif = Notification(
            user_id=uid, type=type_, titre=titre, message=message,
            ref_id=ref_id, ref_type=ref_type,
        )
        db.add(notif)
    db.commit()

def _ids_admins(db: Session) -> list:
    """Retourne les IDs de tous les admins et admins généraux non suspendus."""
    return [u.id for u in db.query(User).filter(
        User.role.in_(["admin", "admin_general"]),
        User.suspendu == False
    ).all()]

def _ids_classe(db: Session, classe: str) -> list:
    """Retourne les IDs des étudiants d'une classe donnée."""
    return [u.id for u in db.query(User).filter(
        User.classe == classe,
        User.role == "etudiant",
        User.suspendu == False
    ).all()]

def _ids_cible_info(db: Session, cible: str) -> list:
    """Retourne les IDs des utilisateurs ciblés par une info."""
    q = db.query(User).filter(User.suspendu == False)
    if cible == "tous":
        pass  # tout le monde
    elif cible.startswith("site_"):
        # On notifie tout le monde pour les infos de site (pas de champ site sur User)
        pass
    else:
        # cible = code filière → uniquement les étudiants de cette filière
        q = q.filter(User.filiere == cible)
    return [u.id for u in q.all()]

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  MOTEUR IA KENNY                                                         ║
# ╚══════════════════════════════════════════════════════════════════════════╝

CAT_KW = {
    "wifi":        ["wifi","wi-fi","internet","connexion","réseau","débit","lent","coupure","signal","ping","déconnecté"],
    "electricite": ["électricité","courant","prise","lumière","éclairage","panne électrique","court-circuit","disjoncteur","alimentation"],
    "eau":         ["eau","fuite","robinet","lavabo","tuyau","plomberie","inondation","humidité","dégât des eaux","wc bouchés"],
    "salle":       ["salle","classe","amphi","tableau","chaise","bureau","projecteur","vidéoprojecteur","climatisation","clim","chaleur","froid"],
    "admin":       ["administration","secrétariat","dossier","inscription","document","certificat","attestation","frais","scolarité","paiement","bourse","emploi du temps","horaire"],
    "securite":    ["sécurité","danger","risque","accident","agression","vol","incendie","feu","fumée","gardien","glissant","blessure"],
    "cafeteria":   ["cafétéria","restaurant","cantine","repas","nourriture","hygiène","odeur","cuisine","menu"],
    "sanitaire":   ["toilette","wc","sanitaire","lavabo","savon","papier","propreté","nettoyage","douche"],
    "bibliotheque":["bibliothèque","livre","lecture","imprimante","scanner","photocopie","documentation"],
    "autre":       [],
}

# Ces catégories sont TOUJOURS urgentes (sécurité physique des étudiants)
CATEGORIES_CRITIQUES = {"eau", "electricite", "securite"}

URGENCE_KW    = ["urgent","urgence","danger","grave","critique","sos","maintenant","vite","rapidement",
                 "impossible","bloqué","tout de suite","secours","aide","inondation","feu","blessé","fuite"]
FRUSTRATION_KW= ["frustrant","frustré","marre","ras le bol","insupportable","inacceptable","encore",
                 "toujours pareil","jamais réglé","inutile","catastrophique","honteux","inadmissible","nul"]
COLERE_KW     = ["colère","furieux","révolté","dégoutant","incompétent","rien ne change","plainte","scandaleux"]

def _norm(t: str) -> str:
    t = t.lower()
    for a,b in [('é','e'),('è','e'),('ê','e'),('à','a'),('â','a'),('ù','u'),('û','u'),
                ('î','i'),('ô','o'),('ç','c'),('ë','e'),('ü','u'),('ï','i')]:
        t = t.replace(a, b)
    return t

def _tokens(t: str) -> set:
    t = _norm(t)
    stops = {"les","des","une","est","que","qui","pas","par","pour","dans","sur","avec","son",
             "mais","donc","car","bien","tout","plus","tres","aussi","quand","comme","cette",
             "depuis","avoir","nous","vous","leur","etre","fait","trop","peu","mon","ma","mes"}
    return {w for w in re.findall(r'\b\w{3,}\b', t) if w not in stops}

def _jaccard(a: str, b: str) -> float:
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb: return 0.0
    return round(len(ta & tb) / len(ta | tb), 3)

def _categoriser_local(titre: str, desc: str) -> dict:
    texte = _norm(titre + " " + desc)
    scores = {}
    for cat, kws in CAT_KW.items():
        if cat == "autre": continue
        s = sum(2 if re.search(r'\b'+re.escape(_norm(k))+r'\b', texte) else
                (1 if _norm(k) in texte else 0) for k in kws)
        scores[cat] = s
    best  = max(scores, key=scores.get) if scores else "autre"
    total = sum(scores.values()) or 1
    return {"categorie": best if scores.get(best, 0) > 0 else "autre",
            "confiance": round(scores.get(best, 0) / total, 2)}

def _analyser_emotion_local(titre: str, desc: str) -> dict:
    texte = _norm(titre + " " + desc)
    urg = sum(1 for k in URGENCE_KW     if _norm(k) in texte)
    fru = sum(1 for k in FRUSTRATION_KW if _norm(k) in texte)
    col = sum(1 for k in COLERE_KW      if _norm(k) in texte)
    score = urg * 3 + fru * 2 + col * 2
    if urg > 0:   emo = "urgence"
    elif fru > 0: emo = "frustration"
    elif col > 0: emo = "colere"
    else:         emo = "neutre"
    return {"emotion": emo, "score": score, "niveau_urgence": min(5, score)}

def _score_ia(likes: int, created_at: datetime, score_emo: int, nb_comm: int) -> float:
    age = max(0.1, (datetime.utcnow() - created_at).total_seconds() / 86400)
    return round((likes * 2 + max(0, score_emo) * 1.5 + nb_comm * 0.5) / age, 2)

# ── Appel Groq API (GRATUIT — console.groq.com) ─────────────────────────────
# Modèle : llama-3.1-8b-instant — rapide, gratuit, excellent en français
# 14 400 requêtes/jour gratuites, aucune carte bancaire requise

async def _claude(prompt: str, max_tokens: int = 600) -> str:
    """Appelle Groq (LLaMA 3.1) gratuitement. Même interface que Claude."""
    if not GROQ_API_KEY:
        return ""
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}",
                         "Content-Type": "application/json"},
                json={"model": "llama-3.1-8b-instant",
                      "max_tokens": max_tokens,
                      "temperature": 0.2,
                      "messages": [{"role": "user", "content": prompt}]},
            )
        d = r.json()
        return d["choices"][0]["message"]["content"] if r.status_code == 200 else ""
    except Exception:
        return ""

def _parse_json(raw: str) -> dict:
    try:
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        return json.loads(m.group()) if m else {}
    except Exception:
        return {}

async def _claude_analyser_signalement(titre: str, desc: str, cat: str) -> dict:
    prompt = f"""Tu es l'IA de CampusVoice, une plateforme de signalement universitaire à l'École AFI (Dakar, Sénégal).

Un étudiant a signalé :
Titre : {titre}
Description : {desc}
Catégorie : {cat}

Réponds UNIQUEMENT en JSON valide (aucun texte autour) :
{{
  "urgence": <1-5 — IMPORTANT: mets 5 pour eau/fuite/électricité/incendie/agression, 4 pour wifi coupé/clim en panne/salle inutilisable, 3 pour admin/notes, 2-1 pour amélioration ordinaire>,
  "emotion": "<urgence|frustration|colere|neutre>",
  "categorie_confirmee": "<wifi|electricite|eau|salle|admin|securite|cafeteria|sanitaire|bibliotheque|autre>",
  "decision_strategique": "<recommandation courte et concrète pour l'administration — ex: Intervention technique immédiate requise dans les 4h>",
  "action_concrete": "<action précise pour résoudre — ex: Contacter le service de maintenance pour colmater la fuite et sécuriser la zone>",
  "resume_ia": "<2-3 phrases de synthèse professionnelle pour le tableau de bord admin>"
}}"""
    return _parse_json(await _claude(prompt, 400))

async def _claude_analyser_notes(notes: list, prenom: str) -> dict:
    if not notes:
        return {}
    lignes = "\n".join(f"- {n['matiere']} ({n['semestre']}) : {n['note']}/20" for n in notes)
    prompt = f"""Tu es un conseiller pédagogique IA à l'École AFI.

Notes de {prenom} :
{lignes}

Réponds UNIQUEMENT en JSON valide :
{{
  "niveau": "<excellent|tres_bien|bien|passable|insuffisant>",
  "tendance": "<en_hausse|en_baisse|stable>",
  "points_forts": ["<matière>"],
  "points_faibles": ["<matière>"],
  "recommandations": [
    {{"type": "<alerte|conseil|encouragement|felicitation>", "message": "<message personnalisé et bienveillant>"}}
  ],
  "message_global": "<2 phrases de bilan personnalisé pour motiver l'étudiant>"
}}"""
    return _parse_json(await _claude(prompt, 500))

async def _claude_rapport(sigs: list) -> dict:
    if not sigs:
        return {}
    resume = json.dumps([{"titre": s["titre"], "categorie": s["categorie"],
                          "statut": s["statut"], "urgence": s.get("niveau_urgence", 0)}
                         for s in sigs[:25]], ensure_ascii=False)
    prompt = f"""Tu es l'IA stratégique de CampusVoice pour l'administration de l'École AFI.

Signalements (JSON) :
{resume}

Réponds UNIQUEMENT en JSON valide :
{{
  "synthese": "<2-3 phrases résumant la situation globale du campus>",
  "probleme_prioritaire": "<le problème le plus critique à traiter en premier>",
  "recommandations_strategiques": ["<recommandation 1>", "<recommandation 2>", "<recommandation 3>"],
  "actions_immediates": ["<action dans les 24h>", "<action cette semaine>"],
  "tendance_campus": "<amelioration|degradation|stable>"
}}"""
    return _parse_json(await _claude(prompt, 600))

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  ROUTES BASE                                                             ║
# ╚══════════════════════════════════════════════════════════════════════════╝

@app.get("/", tags=["Base"])
def root():
    return {"message": "CampusVoice API v3.0 🚀",
            "ia_groq": bool(GROQ_API_KEY),
            "modules": ["Auth (matricule)", "Signalements", "IA intégrée", "Notes", "Dashboard", "Export PDF"]}

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  AUTH — MATRICULE AFI                                                    ║
# ╚══════════════════════════════════════════════════════════════════════════╝

@app.get("/referentiels", tags=["Auth"])
def get_referentiels():
    """Retourne les filières et niveaux officiels de l'école AFI."""
    return {
        "filieres": [{"code": k, "label": v} for k, v in FILIERES.items()],
        "niveaux":  [{"code": k, "label": v} for k, v in NIVEAUX.items()],
    }

@app.post("/register", tags=["Auth"])
def register(
    # Accepte aussi bien JSON (UserRegister) que form-urlencoded envoyé par le frontend
    # username = matricule (convention OAuth2 réutilisée pour la compatibilité)
    username:     str           = None,   # form field (matricule)
    password:     str           = None,   # form field
    prenom:       str           = None,
    nom:          str           = None,
    email:        Optional[str] = None,
    filiere:      Optional[str] = None,
    niveau:       Optional[str] = None,
    classe:       Optional[str] = None,   # ignoré — généré automatiquement
    db: Session = Depends(get_db),
):
    """
    Créer un compte étudiant. Accepte x-www-form-urlencoded ou query params.
    username = matricule AFI. La classe est générée automatiquement (filière + niveau).
    """
    from fastapi import Form as _Form
    matricule = (username or "").strip().upper()
    pw        = password or ""
    if not matricule or not pw:
        raise HTTPException(400, "Matricule et mot de passe obligatoires")
    if not re.match(r'^[A-Z0-9]{4,20}$', matricule):
        raise HTTPException(400, "Matricule invalide (lettres majuscules + chiffres, 4-20 caractères)")
    if db.query(User).filter(User.matricule == matricule).first():
        raise HTTPException(400, "Ce matricule est déjà utilisé")

    filiere_code = filiere.strip().upper() if filiere else None
    if filiere_code and filiere_code not in FILIERES:
        raise HTTPException(400, f"Filière invalide. Codes acceptés : {list(FILIERES.keys())}")

    niveau_code = niveau.strip().upper() if niveau else None
    if niveau_code and niveau_code not in NIVEAUX:
        raise HTTPException(400, f"Niveau invalide. Codes acceptés : {list(NIVEAUX.keys())}")

    classe_gen = _gen_classe(filiere_code, niveau_code) if filiere_code and niveau_code else None
    email_val  = email or f"{matricule.lower()}@afi.sn"

    user = User(
        matricule    = matricule,
        nom          = (nom or "Nouvel").strip(),
        prenom       = (prenom or "Utilisateur").strip(),
        email        = email_val,
        mot_de_passe = hash_password(pw),
        filiere      = filiere_code,
        niveau       = niveau_code,
        classe       = classe_gen,
        role         = "etudiant",
    )
    db.add(user); db.commit(); db.refresh(user)
    return {
        "message":  "Compte créé ✅",
        "matricule": user.matricule,
        "classe":    user.classe,
        "filiere":   FILIERES.get(user.filiere, user.filiere) if user.filiere else None,
        "niveau":    NIVEAUX.get(user.niveau, user.niveau) if user.niveau else None,
    }

class AdminCreate(BaseModel):
    matricule:    str
    mot_de_passe: str
    nom:          str
    prenom:       str
    email:        Optional[str] = None
    role:         Optional[str] = "admin"   # admin | admin_general (dans le body JSON)

@app.post("/admin/creer", tags=["Gestion Users"])
def creer_admin(
    data: AdminCreate,
    role_cible: Optional[str] = None,   # query param optionnel (rétrocompat)
    u: User = Depends(require_admin_general), db: Session = Depends(get_db),
):
    """
    Créer un compte admin ou admin_general.
    Réservé à l'admin général.
    Envoyer role dans le body JSON ou role_cible en query param.
    """
    # Priorité : query param > body field
    role_final = role_cible or data.role or "admin"
    if role_final not in {"admin", "admin_general"}:
        raise HTTPException(400, "role doit être 'admin' ou 'admin_general'")
    role_cible = role_final  # rebind pour la suite
    matricule = data.matricule.strip().upper()
    if db.query(User).filter(User.matricule == matricule).first():
        raise HTTPException(400, "Ce matricule est déjà utilisé")
    user = User(
        matricule    = matricule,
        nom          = data.nom.strip(),
        prenom       = data.prenom.strip(),
        email        = data.email or f"{matricule.lower()}@afi.sn",
        mot_de_passe = hash_password(data.mot_de_passe),
        role         = role_cible,
    )
    db.add(user); db.commit(); db.refresh(user)
    return {"message": f"Compte {role_cible} créé ✅", "matricule": user.matricule, "role": user.role,
            "classe": user.classe}

@app.post("/token", tags=["Auth"])
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Connexion avec matricule AFI + mot de passe."""
    matricule = form_data.username.strip().upper()
    user = db.query(User).filter(User.matricule == matricule).first()
    if not user or not verify_password(form_data.password, user.mot_de_passe):
        raise HTTPException(401, "Matricule ou mot de passe incorrect")
    return {"access_token": create_access_token({"sub": user.matricule}), "token_type": "bearer"}

@app.get("/me", tags=["Auth"])
def get_me(u: User = Depends(get_current_active_user)):
    return {
        "id": u.id, "matricule": u.matricule, "nom": u.nom, "prenom": u.prenom,
        "role": u.role, "suspendu": u.suspendu,
        "filiere_code":  u.filiere,
        "filiere_label": FILIERES.get(u.filiere, u.filiere) if u.filiere else None,
        "niveau_code":   u.niveau,
        "niveau_label":  NIVEAUX.get(u.niveau, u.niveau) if u.niveau else None,
        "classe":        u.classe,
        "photo_url":     u.photo_url,
        "email":         u.email,
        "xp":            u.xp or 0,
        "badges":        [b for b in (u.badges or "").split(",") if b],
    }

@app.patch("/me", tags=["Auth"])
def update_profile(
    nom:          Optional[str] = None,
    prenom:       Optional[str] = None,
    filiere:      Optional[str] = None,
    niveau:       Optional[str] = None,
    photo_url:    Optional[str] = None,
    mot_de_passe: Optional[str] = None,
    u: User = Depends(get_current_active_user), db: Session = Depends(get_db),
):
    """
    Modifier son profil. Le matricule ne peut JAMAIS être modifié.
    La classe est recalculée automatiquement si filière ou niveau change.
    """
    if nom:    u.nom    = nom.strip()
    if prenom: u.prenom = prenom.strip()

    if filiere:
        fc = filiere.strip().upper()
        if fc not in FILIERES:
            raise HTTPException(400, f"Filière invalide. Codes : {list(FILIERES.keys())}")
        u.filiere = fc

    if niveau:
        nc = niveau.strip().upper()
        if nc not in NIVEAUX:
            raise HTTPException(400, f"Niveau invalide. Codes : {list(NIVEAUX.keys())}")
        u.niveau = nc

    # Régénérer la classe automatiquement si filière ou niveau a changé
    if (filiere or niveau) and u.filiere and u.niveau:
        u.classe = _gen_classe(u.filiere, u.niveau)

    if photo_url:    u.photo_url = photo_url
    if mot_de_passe:
        if len(mot_de_passe) < 6:
            raise HTTPException(400, "Le mot de passe doit faire au moins 6 caractères")
        u.mot_de_passe = hash_password(mot_de_passe)

    db.commit()
    return {
        "message": "Profil mis à jour ✅",
        "classe":  u.classe,
        "filiere": FILIERES.get(u.filiere, u.filiere) if u.filiere else None,
        "niveau":  NIVEAUX.get(u.niveau, u.niveau) if u.niveau else None,
    }

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  SIGNALEMENTS                                                            ║
# ╚══════════════════════════════════════════════════════════════════════════╝

# Rôles autorisés à voir l'identité réelle même sur une publication anonyme
ROLES_VOIR_ANONYME = {"admin_general"}

@app.post("/transcription", tags=["Signalements"])
async def transcrire_audio(
    audio: UploadFile = File(...),
    _: User = Depends(get_current_active_user),
):
    """Transcrit un fichier audio (webm/ogg/mp3/wav) en texte via Groq Whisper."""
    if not GROQ_API_KEY:
        raise HTTPException(503, "Clé Groq manquante — transcription indisponible")
    contenu = await audio.read()
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                files={"file": (audio.filename or "audio.webm", contenu, audio.content_type or "audio/webm")},
                data={"model": "whisper-large-v3", "language": "fr", "response_format": "json"},
            )
        if r.status_code != 200:
            raise HTTPException(500, f"Erreur Groq Whisper : {r.text}")
        return {"texte": r.json().get("text", "")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Erreur transcription : {str(e)}")

@app.post("/signalements", tags=["Signalements"])
async def create_signalement(
    data: SignalementCreate,
    u: User = Depends(get_current_active_user), db: Session = Depends(get_db),
):
    # 1. Analyse locale rapide (toujours disponible)
    cat_local = _categoriser_local(data.titre, data.description)
    emo_local  = _analyser_emotion_local(data.titre, data.description)
    categorie  = data.categorie or cat_local["categorie"]

    # 2. Urgence auto pour catégories critiques (eau, élec, sécurité)
    niveau_urgence = emo_local["niveau_urgence"]
    if categorie in CATEGORIES_CRITIQUES:
        niveau_urgence = max(niveau_urgence, 4)

    # 3. Enrichissement Claude (async)
    ia = await _claude_analyser_signalement(data.titre, data.description, categorie)

    if ia:
        niveau_urgence = max(niveau_urgence, ia.get("urgence", niveau_urgence))
        categorie      = ia.get("categorie_confirmee", categorie)
        # Recalculer urgence si Claude a changé la catégorie
        if categorie in CATEGORIES_CRITIQUES:
            niveau_urgence = max(niveau_urgence, 4)
        emotion  = ia.get("emotion", emo_local["emotion"])
        decision = ia.get("decision_strategique", "")
        action   = ia.get("action_concrete", "")
        resume   = ia.get("resume_ia", "")
    else:
        emotion = emo_local["emotion"]
        decision = action = resume = ""

    score = _score_ia(0, datetime.utcnow(), emo_local["score"], 0)

    sig = Signalement(
        titre=data.titre, description=data.description, categorie=categorie,
        localisation=data.localisation, type_publication=data.type_publication or "public",
        anonyme=data.anonyme or False,
        visibilite=data.visibilite or "tous",
        user_id=u.id, score_emotionnel=emo_local["score"], emotion_dominante=emotion,
        niveau_urgence=niveau_urgence, categorie_auto=(data.categorie is None),
        confiance_categorie=cat_local["confiance"], score_ia=score,
        decision_strategique=decision, action_concrete=action, resume_ia=resume,
    )
    db.add(sig); db.commit(); db.refresh(sig)
    _xp(u, 5, db)

    # ── Notifications ───────────────────────────────────────────────────────
    anon_label = "Anonyme" if sig.anonyme else f"{u.prenom} {u.nom}"
    # → Admins : nouveau signalement
    _notifier(
        db, _ids_admins(db),
        type_="signalement_nouveau",
        titre="📢 Nouveau signalement",
        message=f"{anon_label} a publié : « {sig.titre} » — Catégorie : {sig.categorie} — Urgence : {sig.niveau_urgence}/5",
        ref_id=sig.id, ref_type="signalement",
    )
    # ────────────────────────────────────────────────────────────────────────

    return {
        "id": sig.id, "titre": sig.titre, "description": sig.description,
        "categorie": sig.categorie, "statut": sig.statut, "likes": sig.likes,
        "score_ia": sig.score_ia, "localisation": sig.localisation,
        "created_at": sig.created_at.isoformat(),
        "ia": {
            "categorie": sig.categorie, "emotion": sig.emotion_dominante,
            "niveau_urgence": sig.niveau_urgence,
            "decision_strategique": sig.decision_strategique,
            "action_concrete": sig.action_concrete,
            "resume": sig.resume_ia,
        },
        "xp_gagne": 5,
    }

@app.get("/signalements", tags=["Signalements"])
def get_signalements(
    categorie: Optional[str] = None, statut: Optional[str] = None,
    token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db),
):
    # Identifier l'utilisateur connecté (optionnel — pas d'erreur si non connecté)
    current_user = None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        mat = payload.get("sub")
        if mat:
            current_user = db.query(User).filter(User.matricule == mat).first()
    except Exception:
        pass

    role = current_user.role if current_user else None
    est_admin = role in ROLES_VOIR_ANONYME

    q = db.query(Signalement)
    if categorie: q = q.filter(Signalement.categorie == categorie)
    if statut:    q = q.filter(Signalement.statut == statut)

    # Filtrage par visibilité
    if est_admin:
        pass  # Les admins voient tout
    elif current_user:
        # Étudiant connecté : voit "tous" + sa propre filière + pas "admin seul"
        from sqlalchemy import or_
        q = q.filter(or_(
            Signalement.visibilite == "tous",
            Signalement.visibilite == "filiere",   # filtré ci-dessous si filière connue
            Signalement.user_id == current_user.id  # toujours voir ses propres
        ))
        # Affiner : si visibilite=filiere, ne montrer que si même filière
        sigs_raw = q.order_by(Signalement.score_ia.desc()).all()
        sigs = []
        for s in sigs_raw:
            if s.visibilite == "filiere":
                auteur = db.query(User).filter(User.id == s.user_id).first()
                if auteur and current_user.filiere and auteur.filiere == current_user.filiere:
                    sigs.append(s)
                elif s.user_id == current_user.id:
                    sigs.append(s)
            else:
                sigs.append(s)
    else:
        # Non connecté : uniquement les signalements publics non admin
        q = q.filter(Signalement.visibilite == "tous")
        sigs = q.order_by(Signalement.score_ia.desc()).all()

    if est_admin or not current_user:
        sigs = q.order_by(Signalement.score_ia.desc()).all() if est_admin else sigs

    def _fmt(s: Signalement):
        auteur_visible = est_admin or (current_user and s.user_id == current_user.id)
        auteur = db.query(User).filter(User.id == s.user_id).first() if auteur_visible or not s.anonyme else None
        return {
            "id": s.id, "titre": s.titre, "description": s.description,
            "categorie": s.categorie, "statut": s.statut, "likes": s.likes,
            "score_ia": s.score_ia, "localisation": s.localisation,
            "visibilite": s.visibilite, "anonyme": s.anonyme,
            "auteur": (
                f"{auteur.prenom} {auteur.nom}" if auteur and (not s.anonyme or auteur_visible) else "Anonyme"
            ),
            "score_emotionnel": s.score_emotionnel, "emotion_dominante": s.emotion_dominante,
            "niveau_urgence": s.niveau_urgence, "categorie_auto": s.categorie_auto,
            "decision_strategique": s.decision_strategique if est_admin else None,
            "action_concrete": s.action_concrete if est_admin else None,
            "created_at": s.created_at.isoformat(),
        }

    return [_fmt(s) for s in sigs]

@app.get("/signalements/{id}", tags=["Signalements"])
def get_signalement(
    id: int,
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    s = db.query(Signalement).filter(Signalement.id == id).first()
    if not s: raise HTTPException(404, "Signalement introuvable")

    current_user = None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        mat = payload.get("sub")
        if mat:
            current_user = db.query(User).filter(User.matricule == mat).first()
    except Exception:
        pass

    est_admin = current_user and current_user.role in ROLES_VOIR_ANONYME
    auteur_visible = est_admin or (current_user and s.user_id == current_user.id)
    auteur = db.query(User).filter(User.id == s.user_id).first()

    return {
        "id": s.id, "titre": s.titre, "description": s.description,
        "categorie": s.categorie, "statut": s.statut, "likes": s.likes,
        "score_ia": s.score_ia, "localisation": s.localisation,
        "visibilite": s.visibilite, "anonyme": s.anonyme,
        "auteur": (
            f"{auteur.prenom} {auteur.nom}" if auteur and (not s.anonyme or auteur_visible) else "Anonyme"
        ),
        "niveau_urgence": s.niveau_urgence, "emotion_dominante": s.emotion_dominante,
        "decision_strategique": s.decision_strategique if est_admin else None,
        "action_concrete": s.action_concrete if est_admin else None,
        "created_at": s.created_at.isoformat(),
    }

@app.post("/signalements/{id}/like", tags=["Signalements"])
def like_signalement(id: int, u: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    s = db.query(Signalement).filter(Signalement.id == id).first()
    if not s: raise HTTPException(404, "Signalement introuvable")
    nb = db.query(Commentaire).filter(Commentaire.signalement_id == id).count()
    s.likes += 1
    s.score_ia = _score_ia(s.likes, s.created_at, s.score_emotionnel or 0, nb)
    db.commit(); db.refresh(s)
    _xp(u, 1, db)
    return {"score_ia": s.score_ia, "likes": s.likes}

@app.patch("/signalements/{id}/statut", tags=["Signalements"])
def update_statut(
    id: int, data: SignalementUpdate,
    u: User = Depends(get_current_active_user), db: Session = Depends(get_db),
):
    """
    Met à jour le statut d'un signalement.
    Valeurs valides : en_attente | en_cours | pris_en_charge | resolu
    """
    s = db.query(Signalement).filter(Signalement.id == id).first()
    if not s: raise HTTPException(404, "Signalement introuvable")
    valides = ["en_attente", "en_cours", "pris_en_charge", "resolu"]
    if data.statut not in valides:
        raise HTTPException(400, f"Statut invalide. Valeurs acceptées : {valides}")
    s.statut = data.statut
    db.commit(); db.refresh(s)

    # ── Notification → auteur du signalement ────────────────────────────────
    statut_labels = {
        "en_attente":     "⏳ En attente de traitement",
        "en_cours":       "🔧 En cours de traitement",
        "pris_en_charge": "✋ Pris en charge par l'administration",
        "resolu":         "✅ Résolu !",
    }
    if s.user_id:
        _notifier(
            db, [s.user_id],
            type_="signalement_statut",
            titre=f"Mise à jour : {statut_labels.get(s.statut, s.statut)}",
            message=f"Votre signalement « {s.titre} » a été mis à jour : {statut_labels.get(s.statut, s.statut)}",
            ref_id=s.id, ref_type="signalement",
        )
    # ────────────────────────────────────────────────────────────────────────

    return {"message": f"Statut → {s.statut}", "id": s.id, "statut": s.statut}

@app.post("/signalements/{id}/commentaires", tags=["Commentaires"])
def add_commentaire(
    id: int, data: CommentaireCreate,
    u: User = Depends(get_current_active_user), db: Session = Depends(get_db),
):
    s = db.query(Signalement).filter(Signalement.id == id).first()
    if not s: raise HTTPException(404, "Signalement introuvable")
    c = Commentaire(contenu=data.contenu, user_id=u.id, signalement_id=id)
    db.add(c); db.commit(); db.refresh(c)
    nb = db.query(Commentaire).filter(Commentaire.signalement_id == id).count()
    s.score_ia = _score_ia(s.likes, s.created_at, s.score_emotionnel or 0, nb)
    db.commit()
    _xp(u, 2, db)
    return c

@app.get("/signalements/{id}/commentaires", tags=["Commentaires"])
def get_commentaires(id: int, db: Session = Depends(get_db)):
    return db.query(Commentaire).filter(Commentaire.signalement_id == id).all()

@app.post("/signalements/{id}/satisfaction", tags=["Signalements"])
def add_satisfaction(
    id: int, data: SatisfactionCreate,
    u: User = Depends(get_current_active_user), db: Session = Depends(get_db),
):
    s = db.query(Signalement).filter(Signalement.id == id).first()
    if not s: raise HTTPException(404, "Signalement introuvable")
    if s.statut != "resolu":
        raise HTTPException(400, "Le signalement n'est pas encore résolu")
    sat = Satisfaction(note_satisfaction=data.note_satisfaction, avis=data.avis,
                       user_id=u.id, signalement_id=id)
    db.add(sat); db.commit()
    return {"message": "Avis enregistré ✅", "note": data.note_satisfaction}

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  IA — ENDPOINTS                                                          ║
# ╚══════════════════════════════════════════════════════════════════════════╝

@app.post("/ia/analyser", tags=["IA"])
async def ia_analyser(titre: str, description: str, db: Session = Depends(get_db)):
    """
    Analyse complète AVANT publication :
    catégorie, émotion, urgence, décision stratégique, action, doublons.
    """
    cat  = _categoriser_local(titre, description)
    emo  = _analyser_emotion_local(titre, description)
    ia   = await _claude_analyser_signalement(titre, description, cat["categorie"])

    niveau_urgence = emo["niveau_urgence"]
    categorie = cat["categorie"]
    if ia:
        niveau_urgence = max(niveau_urgence, ia.get("urgence", niveau_urgence))
        categorie      = ia.get("categorie_confirmee", categorie)
    if categorie in CATEGORIES_CRITIQUES:
        niveau_urgence = max(niveau_urgence, 4)

    # Détection doublons sémantique
    existants = db.query(Signalement).filter(Signalement.statut != "resolu").all()
    doublons = []
    for s in existants:
        sim = _jaccard(titre+" "+description, s.titre+" "+s.description)
        if sim >= 0.28:
            doublons.append({"id": s.id, "titre": s.titre, "similarite": sim, "statut": s.statut})
    doublons.sort(key=lambda x: x["similarite"], reverse=True)

    return {
        "categorie": categorie,
        "confiance": cat["confiance"],
        "emotion": ia.get("emotion", emo["emotion"]) if ia else emo["emotion"],
        "niveau_urgence": niveau_urgence,
        "decision_strategique": ia.get("decision_strategique", "") if ia else "",
        "action_concrete": ia.get("action_concrete", "") if ia else "",
        "resume": ia.get("resume_ia", "") if ia else "",
        "doublons": {
            "detectes": len(doublons) > 0,
            "liste": doublons[:3],
            "conseil": "⚠️ Signalement similaire déjà existant — pense à liker/commenter plutôt que republier."
                       if doublons else "✅ Aucun doublon détecté.",
        },
    }

@app.get("/ia/urgences", tags=["IA"])
def ia_urgences(u: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Signalements urgents (niveau ≥ 3) non résolus. Réservé aux admins."""
    sigs = db.query(Signalement).filter(
        Signalement.niveau_urgence >= 3, Signalement.statut != "resolu",
    ).order_by(Signalement.niveau_urgence.desc(), Signalement.score_ia.desc()).all()
    return {
        "total": len(sigs),
        "signalements": [{
            "id": s.id, "titre": s.titre, "categorie": s.categorie,
            "emotion": s.emotion_dominante, "niveau_urgence": s.niveau_urgence,
            "score_ia": s.score_ia, "statut": s.statut,
            "decision": s.decision_strategique, "action": s.action_concrete,
            "created_at": s.created_at.isoformat(),
        } for s in sigs],
    }

@app.get("/ia/rapport", tags=["IA"])
async def ia_rapport(u: User = Depends(require_admin_general), db: Session = Depends(get_db)):
    """Rapport stratégique IA global. Réservé à l'administrateur général."""
    sigs  = db.query(Signalement).all()
    data  = [{"titre": s.titre, "categorie": s.categorie, "statut": s.statut,
               "score_ia": s.score_ia, "niveau_urgence": s.niveau_urgence or 0} for s in sigs]
    total = len(sigs)
    resolus = sum(1 for s in sigs if s.statut == "resolu")
    cats    = {}
    for s in sigs: cats[s.categorie] = cats.get(s.categorie, 0) + 1
    claude_res = await _claude_rapport(data)
    return {
        "total_signalements": total,
        "taux_resolution": round(resolus / total * 100, 1) if total else 0,
        "distribution_categories": cats,
        "signalements_urgents": sum(1 for s in sigs if (s.niveau_urgence or 0) >= 3 and s.statut != "resolu"),
        "analyse_claude": claude_res,
        "genere_le": datetime.utcnow().isoformat(),
    }

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  NOTES + ANALYSE IA                                                      ║
# ╚══════════════════════════════════════════════════════════════════════════╝

class NoteCreateAdmin(BaseModel):
    matiere:              str
    note:                 float = Field(..., ge=0, le=20)
    semestre:             str
    user_id:              Optional[int]  = None   # ID de l'étudiant cible
    matricule_etudiant:   Optional[str]  = None   # Matricule de l'étudiant cible (alternative)

@app.post("/notes", tags=["Notes"])
def create_note(data: NoteCreateAdmin, u: User = Depends(require_admin), db: Session = Depends(get_db)):
    """
    Ajouter une note à un étudiant. Réservé aux admins.
    Fournir user_id (ID BDD) ou matricule_etudiant (matricule AFI).
    Si aucun n'est fourni, la note est attribuée à l'admin lui-même (test uniquement).
    """
    target_id = u.id  # fallback

    if data.user_id:
        etudiant = db.query(User).filter(User.id == data.user_id).first()
        if not etudiant:
            raise HTTPException(404, f"Étudiant introuvable (id={data.user_id})")
        target_id = etudiant.id
    elif data.matricule_etudiant:
        mat = data.matricule_etudiant.strip().upper()
        etudiant = db.query(User).filter(User.matricule == mat).first()
        if not etudiant:
            raise HTTPException(404, f"Étudiant introuvable (matricule={mat})")
        target_id = etudiant.id

    n = Note(matiere=data.matiere, note=data.note, semestre=data.semestre, user_id=target_id)
    db.add(n); db.commit(); db.refresh(n)
    return {"id": n.id, "matiere": n.matiere, "note": n.note, "semestre": n.semestre,
            "user_id": n.user_id, "created_at": n.created_at.isoformat()}

@app.get("/notes", tags=["Notes"])
def get_notes(u: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    return db.query(Note).filter(Note.user_id == u.id).all()

@app.get("/notes/moyenne", tags=["Notes"])
def get_moyenne(u: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    notes = db.query(Note).filter(Note.user_id == u.id).all()
    if not notes: return {"message": "Aucune note", "moyennes": {}}
    par = {}
    for n in notes: par.setdefault(n.semestre, []).append(n.note)
    return {
        "moyennes": {s: round(sum(v)/len(v), 2) for s, v in par.items()},
        "moyenne_generale": round(sum(n.note for n in notes) / len(notes), 2),
    }


@app.get("/notes/etudiant/{user_id}", tags=["Notes"])
def get_notes_etudiant(
    user_id: int,
    u: User = Depends(require_admin), db: Session = Depends(get_db)
):
    """Consulter les notes d'un étudiant spécifique. Réservé aux admins."""
    etudiant = db.query(User).filter(User.id == user_id).first()
    if not etudiant:
        raise HTTPException(404, "Étudiant introuvable")
    notes = db.query(Note).filter(Note.user_id == user_id).all()
    return {
        "etudiant": {"id": etudiant.id, "matricule": etudiant.matricule,
                     "nom": etudiant.nom, "prenom": etudiant.prenom, "classe": etudiant.classe},
        "notes": [{"id": n.id, "matiere": n.matiere, "note": n.note,
                   "semestre": n.semestre, "created_at": n.created_at.isoformat()} for n in notes],
        "moyenne_generale": round(sum(n.note for n in notes) / len(notes), 2) if notes else None,
    }

@app.get("/notes/analyse", tags=["IA"])
async def analyser_notes(u: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Analyse IA des performances académiques via Claude."""
    notes_obj  = db.query(Note).filter(Note.user_id == u.id).all()
    notes_list = [{"matiere": n.matiere, "note": n.note, "semestre": n.semestre} for n in notes_obj]
    if not notes_list:
        return {"message": "Aucune note à analyser."}
    par_sem = {}
    for n in notes_list: par_sem.setdefault(n["semestre"], []).append(n["note"])
    par_mat = {}
    for n in notes_list: par_mat.setdefault(n["matiere"], []).append(n["note"])
    ia = await _claude_analyser_notes(notes_list, u.prenom)
    return {
        "etudiant": f"{u.prenom} {u.nom}", "matricule": u.matricule,
        "moyenne_generale": round(sum(n["note"] for n in notes_list) / len(notes_list), 2),
        "moyennes_par_semestre": {s: round(sum(v)/len(v), 2) for s, v in par_sem.items()},
        "moyennes_par_matiere":  {m: round(sum(v)/len(v), 2) for m, v in par_mat.items()},
        "analyse_ia": ia,
    }

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  DASHBOARD                                                               ║
# ╚══════════════════════════════════════════════════════════════════════════╝

@app.get("/dashboard/kpis", tags=["Dashboard"])
def get_kpis(u: User = Depends(require_admin_general), db: Session = Depends(get_db)):
    total    = db.query(Signalement).count()
    resolus  = db.query(Signalement).filter(Signalement.statut == "resolu").count()
    en_cours = db.query(Signalement).filter(Signalement.statut.in_(["en_cours","pris_en_charge"])).count()
    top_cat  = db.query(Signalement.categorie, func.count(Signalement.id))\
                 .group_by(Signalement.categorie).order_by(func.count(Signalement.id).desc()).first()
    urgences = db.query(Signalement).filter(
        Signalement.niveau_urgence >= 3, Signalement.statut != "resolu").count()
    moy_sat  = db.query(func.avg(Satisfaction.note_satisfaction)).scalar()
    return {
        "total_signalements": total,
        "taux_resolution": round(resolus / total * 100, 1) if total else 0,
        "en_cours": en_cours,
        "categorie_top": top_cat[0] if top_cat else None,
        "signalements_urgents": urgences,
        "satisfaction_moyenne": round(float(moy_sat), 1) if moy_sat else None,
    }

@app.get("/dashboard/top5", tags=["Dashboard"])
def get_top5(u: User = Depends(require_admin_general), db: Session = Depends(get_db)):
    sigs = db.query(Signalement).order_by(Signalement.score_ia.desc()).limit(5).all()
    return [{"id": s.id, "titre": s.titre, "categorie": s.categorie, "score_ia": s.score_ia,
             "likes": s.likes, "statut": s.statut, "emotion": s.emotion_dominante,
             "niveau_urgence": s.niveau_urgence, "decision": s.decision_strategique,
             "action": s.action_concrete} for s in sigs]

@app.get("/dashboard/alertes", tags=["Dashboard"])
def get_alertes(u: User = Depends(require_admin_general), db: Session = Depends(get_db)):
    limite = datetime.utcnow() - timedelta(hours=48)
    sigs   = db.query(Signalement).filter(Signalement.created_at >= limite).all()
    alertes = []
    for s in sigs:
        if s.likes >= 3:
            alertes.append({"id": s.id, "titre": s.titre, "categorie": s.categorie,
                             "type": "popularite", "score_ia": s.score_ia, "likes": s.likes,
                             "message": f"🔥 '{s.titre}' — {s.likes} likes en 48h",
                             "action": s.action_concrete})
        elif (s.niveau_urgence or 0) >= 3:
            alertes.append({"id": s.id, "titre": s.titre, "categorie": s.categorie,
                             "type": "urgence", "score_ia": s.score_ia, "likes": s.likes,
                             "message": f"🚨 Urgence niveau {s.niveau_urgence}/5 — {s.titre}",
                             "action": s.action_concrete})
    return {"total_alertes": len(alertes), "alertes": alertes}

@app.get("/dashboard/statistiques", tags=["Dashboard"])
def get_statistiques(u: User = Depends(require_admin_general), db: Session = Depends(get_db)):
    par_cat  = db.query(Signalement.categorie,       func.count(Signalement.id)).group_by(Signalement.categorie).all()
    par_stat = db.query(Signalement.statut,           func.count(Signalement.id)).group_by(Signalement.statut).all()
    par_emo  = db.query(Signalement.emotion_dominante,func.count(Signalement.id)).group_by(Signalement.emotion_dominante).all()
    return {
        "par_categorie": [{"categorie": r[0], "total": r[1]} for r in par_cat],
        "par_statut":    [{"statut":    r[0], "total": r[1]} for r in par_stat],
        "par_emotion":   [{"emotion":   r[0], "total": r[1]} for r in par_emo],
    }

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  EXPORT PDF                                                              ║
# ╚══════════════════════════════════════════════════════════════════════════╝

@app.get("/export/pdf", tags=["Export"])
async def export_pdf(u: User = Depends(require_admin_general), db: Session = Depends(get_db)):
    """Rapport HTML imprimable (Ctrl+P → Enregistrer en PDF dans le navigateur)."""
    sigs    = db.query(Signalement).order_by(Signalement.score_ia.desc()).all()
    total   = len(sigs)
    resolus = sum(1 for s in sigs if s.statut == "resolu")
    urgents = sum(1 for s in sigs if (s.niveau_urgence or 0) >= 3 and s.statut != "resolu")
    now     = datetime.utcnow().strftime("%d/%m/%Y %H:%M")

    SC = {"en_attente":"#f97316","en_cours":"#3b82f6","pris_en_charge":"#8b5cf6","resolu":"#22c55e"}
    UC = {0:"#9ca3af",1:"#9ca3af",2:"#fbbf24",3:"#f97316",4:"#ef4444",5:"#dc2626"}

    rows = ""
    for s in sigs:
        uc = UC.get(s.niveau_urgence or 0, "#9ca3af")
        sc = SC.get(s.statut, "#9ca3af")
        desc_short = (s.description or "")[:90] + ("..." if len(s.description or "") > 90 else "")
        rows += f"""<tr>
          <td>{s.id}</td>
          <td><strong>{s.titre}</strong><br><small style="color:#6b7280">{desc_short}</small></td>
          <td><span style="background:#f1f5f9;padding:2px 7px;border-radius:4px;font-size:10px">{s.categorie}</span></td>
          <td style="color:{sc};font-weight:600;font-size:11px">{s.statut.replace('_',' ')}</td>
          <td style="color:{uc};font-weight:700;text-align:center">{s.niveau_urgence or 0}/5</td>
          <td style="text-align:center">{s.likes}</td>
          <td style="text-align:center">{s.score_ia:.1f}</td>
          <td style="color:#1d4ed8;font-size:10px">{s.decision_strategique or '—'}</td>
          <td style="color:#065f46;font-size:10px">{s.action_concrete or '—'}</td>
          <td style="font-size:10px">{s.created_at.strftime('%d/%m/%Y') if s.created_at else '—'}</td>
        </tr>"""

    html = f"""<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<title>Rapport CampusVoice</title>
<style>
  *{{margin:0;padding:0;box-sizing:border-box}}
  body{{font-family:Arial,sans-serif;font-size:12px;color:#1e293b;padding:24px}}
  h1{{color:#8b1a1a;font-size:22px;margin-bottom:4px}}
  .meta{{color:#64748b;font-size:11px;margin-bottom:20px}}
  .kpis{{display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap}}
  .kpi{{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 20px;text-align:center;min-width:120px}}
  .kv{{font-size:26px;font-weight:700;color:#8b1a1a}}
  .kl{{font-size:10px;color:#64748b;margin-top:2px}}
  table{{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px}}
  th{{background:#8b1a1a;color:white;padding:8px 6px;text-align:left;font-size:11px}}
  td{{padding:7px 5px;border-bottom:1px solid #f1f5f9;vertical-align:top}}
  tr:nth-child(even){{background:#f8fafc}}
  .footer{{margin-top:20px;text-align:center;font-size:10px;color:#94a3b8}}
  .print-btn{{float:right;background:#8b1a1a;color:white;border:none;padding:8px 18px;border-radius:6px;cursor:pointer;font-size:12px;margin-bottom:12px}}
  @media print{{.print-btn{{display:none}}}}
</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ Imprimer / PDF</button>
<h1>📋 CampusVoice — Rapport des signalements</h1>
<div class="meta">Généré le {now} UTC · École AFI · Hackathon AFI-TECH 2026</div>
<div class="kpis">
  <div class="kpi"><div class="kv">{total}</div><div class="kl">Total</div></div>
  <div class="kpi"><div class="kv">{resolus}</div><div class="kl">Résolus</div></div>
  <div class="kpi"><div class="kv">{round(resolus/total*100,1) if total else 0}%</div><div class="kl">Taux résolution</div></div>
  <div class="kpi"><div class="kv" style="color:#ef4444">{urgents}</div><div class="kl">🚨 Urgents</div></div>
</div>
<table><thead><tr>
  <th>#</th><th>Signalement</th><th>Catégorie</th><th>Statut</th>
  <th>Urgence</th><th>Likes</th><th>Score IA</th>
  <th>Décision stratégique (IA)</th><th>Action concrète (IA)</th><th>Date</th>
</tr></thead><tbody>{rows}</tbody></table>
<div class="footer">CampusVoice v3.0 · IA by Claude (Anthropic) · Rapport auto-généré</div>
</body></html>"""

    return Response(content=html, media_type="text/html",
                    headers={"Content-Disposition": f"inline; filename=rapport_campusvoice_{datetime.utcnow().strftime('%Y%m%d')}.html"})

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  GESTION UTILISATEURS                                                    ║
# ╚══════════════════════════════════════════════════════════════════════════╝

@app.get("/users", tags=["Gestion Users"])
def list_users(role: Optional[str] = None, u: User = Depends(require_admin_general), db: Session = Depends(get_db)):
    q = db.query(User)
    if role: q = q.filter(User.role == role)
    users = q.order_by(User.created_at.desc()).all()
    return [{"id": us.id, "matricule": us.matricule, "nom": us.nom, "prenom": us.prenom,
             "email": us.email, "role": us.role, "filiere": us.filiere, "niveau": us.niveau,
             "classe": us.classe, "suspendu": us.suspendu, "xp": us.xp or 0,
             "created_at": us.created_at.isoformat() if us.created_at else None} for us in users]

@app.patch("/users/{user_id}/role", tags=["Gestion Users"])
def update_user_role(user_id: int, data: RoleUpdate, u: User = Depends(require_admin_general), db: Session = Depends(get_db)):
    if data.role not in {"etudiant", "admin", "admin_general"}:
        raise HTTPException(400, "Rôle invalide")
    cible = db.query(User).filter(User.id == user_id).first()
    if not cible: raise HTTPException(404, "Utilisateur introuvable")
    if cible.id == u.id: raise HTTPException(400, "Impossible de modifier votre propre rôle")
    cible.role = data.role; db.commit()
    return {"message": f"Rôle mis à jour → {data.role}", "matricule": cible.matricule}

@app.patch("/users/{user_id}/suspendre", tags=["Gestion Users"])
def suspendre_user(user_id: int, u: User = Depends(require_admin), db: Session = Depends(get_db)):
    cible = db.query(User).filter(User.id == user_id).first()
    if not cible: raise HTTPException(404, "Utilisateur introuvable")
    if cible.id == u.id: raise HTTPException(400, "Impossible de vous suspendre vous-même")
    if u.role == "admin" and cible.role in {"admin", "admin_general"}:
        raise HTTPException(403, "Un admin ne peut suspendre que des étudiants")
    cible.suspendu = not cible.suspendu; db.commit()
    return {"message": f"Compte {'suspendu' if cible.suspendu else 'réactivé'}", "suspendu": cible.suspendu}

@app.delete("/users/{user_id}", tags=["Gestion Users"])
def delete_user(user_id: int, u: User = Depends(require_admin_general), db: Session = Depends(get_db)):
    cible = db.query(User).filter(User.id == user_id).first()
    if not cible: raise HTTPException(404, "Utilisateur introuvable")
    if cible.id == u.id: raise HTTPException(400, "Impossible de supprimer votre propre compte")
    db.delete(cible); db.commit()
    return {"message": f"Compte supprimé : {cible.prenom} {cible.nom}"}

@app.delete("/signalements/{id}", tags=["Signalements"])
def delete_signalement(id: int, u: User = Depends(require_admin_general), db: Session = Depends(get_db)):
    s = db.query(Signalement).filter(Signalement.id == id).first()
    if not s: raise HTTPException(404, "Signalement introuvable")
    db.delete(s); db.commit()
    return {"message": f"Signalement #{id} supprimé"}

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  SALLES                                                                  ║
# ╚══════════════════════════════════════════════════════════════════════════╝

SITES_VALIDES = {"AFI_SIEGE", "AFITECH", "AFIPOINT_E", "LYCEE"}

@app.post("/salles", tags=["Planning"])
def creer_salle(data: SalleCreate, u: User = Depends(require_admin), db: Session = Depends(get_db)):
    if data.site not in SITES_VALIDES:
        raise HTTPException(400, f"Site invalide. Valeurs : {SITES_VALIDES}")
    salle = Salle(site=data.site, nom=data.nom.strip(), capacite=data.capacite)
    db.add(salle); db.commit(); db.refresh(salle)
    return {"id": salle.id, "site": salle.site, "nom": salle.nom, "capacite": salle.capacite}

@app.get("/salles", tags=["Planning"])
def get_salles(site: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Salle).filter(Salle.active == True)
    if site: q = q.filter(Salle.site == site)
    salles = q.order_by(Salle.site, Salle.nom).all()
    return [{"id": s.id, "site": s.site, "nom": s.nom, "capacite": s.capacite} for s in salles]

@app.delete("/salles/{salle_id}", tags=["Planning"])
def delete_salle(salle_id: int, u: User = Depends(require_admin), db: Session = Depends(get_db)):
    s = db.query(Salle).filter(Salle.id == salle_id).first()
    if not s: raise HTTPException(404, "Salle introuvable")
    s.active = False; db.commit()
    return {"message": f"Salle '{s.nom}' désactivée"}

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  PLANNING                                                                ║
# ╚══════════════════════════════════════════════════════════════════════════╝

async def _ia_lire_planning_excel(contenu: bytes, filiere: str, niveau: str, semestre: str, db: Session) -> dict:
    """Lit le fichier Excel via openpyxl et structure les séances."""
    import io
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(500, "openpyxl non installé — ajoutez-le au requirements.txt")

    wb   = openpyxl.load_workbook(io.BytesIO(contenu), data_only=True)
    ws   = wb.active
    rows = list(ws.iter_rows(values_only=True))

    # Détecter la ligne d'en-tête (cherche "module" ou "ue" ou "prof")
    header_idx = 0
    for i, row in enumerate(rows[:10]):
        row_lower = [str(c).lower() if c else "" for c in row]
        if any(k in " ".join(row_lower) for k in ["module","matiere","prof","enseignant","heure"]):
            header_idx = i; break

    headers = [str(c).lower().strip() if c else "" for c in rows[header_idx]]

    def _col(keys):
        for k in keys:
            for i, h in enumerate(headers):
                if k in h: return i
        return None

    i_ue     = _col(["ue","unite","intitule"])
    i_module = _col(["module","matiere","cours"])
    i_prof   = _col(["prof","enseignant","intervenant","formateur"])
    i_heures = _col(["heure","volume","h_prevue","nombre"])
    i_date   = _col(["date","jour","programmation"])
    i_salle  = _col(["salle","local","amphi"])

    classe = _gen_classe(filiere, niveau)

    # Dispatcher les salles disponibles automatiquement selon capacité
    salles_dispo = db.query(Salle).filter(Salle.active == True).order_by(Salle.capacite).all()

    seances_creees = 0
    for row in rows[header_idx + 1:]:
        if not any(row): continue
        def _val(idx): return str(row[idx]).strip() if idx is not None and idx < len(row) and row[idx] else None

        ue_val     = _val(i_ue)     or _val(i_module) or "—"
        module_val = _val(i_module) or ue_val
        prof_val   = _val(i_prof)
        heures_val = float(_val(i_heures) or 0) if _val(i_heures) else 0.0
        date_val   = _val(i_date)
        salle_val  = _val(i_salle)

        if ue_val == "—" and not prof_val: continue

        # Trouver la salle : d'abord celle mentionnée dans le fichier, sinon auto
        salle_obj = None
        if salle_val:
            salle_obj = db.query(Salle).filter(Salle.nom.ilike(f"%{salle_val}%")).first()
        if not salle_obj and salles_dispo:
            salle_obj = salles_dispo[0]  # plus petite salle disponible

        seance = Seance(
            classe=classe, filiere=filiere, niveau=niveau, semestre=semestre,
            ue=ue_val, module=module_val, prof=prof_val,
            date=date_val, heures_prevues=heures_val, duree=3.0,
            salle_id=salle_obj.id if salle_obj else None,
            statut="programme",
        )
        db.add(seance)
        seances_creees += 1

    db.commit()
    return {"seances_importees": seances_creees, "classe": classe, "semestre": semestre}

@app.post("/planning/upload", tags=["Planning"])
async def upload_planning(
    fichier:   UploadFile = File(...),
    filiere:   str = "SRT",
    niveau:    str = "M2",
    semestre:  str = "S1",
    u: User = Depends(require_admin), db: Session = Depends(get_db),
):
    """Téléverser le planning Excel d'une classe. L'IA lit le fichier et crée les séances."""
    if not fichier.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Fichier Excel requis (.xlsx ou .xls)")
    filiere = filiere.strip().upper()
    niveau  = niveau.strip().upper()
    if filiere not in FILIERES: raise HTTPException(400, f"Filière invalide : {list(FILIERES.keys())}")
    if niveau  not in NIVEAUX:  raise HTTPException(400, f"Niveau invalide : {list(NIVEAUX.keys())}")
    contenu = await fichier.read()
    result  = await _ia_lire_planning_excel(contenu, filiere, niveau, semestre, db)
    return {"message": f"Planning importé ✅", **result}

@app.get("/planning/classes", tags=["Planning"])
def get_classes_planning(db: Session = Depends(get_db)):
    """Retourne toutes les classes ayant un planning."""
    classes = db.query(Seance.classe).distinct().order_by(Seance.classe).all()
    return [c[0] for c in classes]

@app.get("/planning", tags=["Planning"])
def get_planning_admin(
    classe:   Optional[str] = None,
    date:     Optional[str] = None,
    semestre: Optional[str] = None,
    u: User = Depends(require_admin), db: Session = Depends(get_db),
):
    """Planning complet (admin) avec filtre par classe et date."""
    q = db.query(Seance)
    if classe:   q = q.filter(Seance.classe == classe)
    if date:     q = q.filter(Seance.date == date)
    if semestre: q = q.filter(Seance.semestre == semestre)
    seances = q.order_by(Seance.date, Seance.heure).all()
    return [_fmt_seance(s) for s in seances]

@app.get("/planning/ma-classe", tags=["Planning"])
def get_mon_planning(
    vue: str = "jour",
    u: User = Depends(get_current_active_user), db: Session = Depends(get_db),
):
    """Planning de la classe de l'étudiant connecté. Vues : jour | semaine | mois | semestre"""
    if not u.classe:
        raise HTTPException(404, "Aucune classe associée à votre compte — mettez à jour votre profil")

    today = datetime.utcnow().date()
    q     = db.query(Seance).filter(Seance.classe == u.classe)

    if vue == "jour":
        q = q.filter(Seance.date == str(today))
    elif vue == "semaine":
        lundi  = today - timedelta(days=today.weekday())
        dimanche = lundi + timedelta(days=6)
        q = q.filter(Seance.date >= str(lundi), Seance.date <= str(dimanche))
    elif vue == "mois":
        debut = today.replace(day=1)
        # fin du mois
        if today.month == 12: fin = today.replace(year=today.year+1, month=1, day=1) - timedelta(days=1)
        else: fin = today.replace(month=today.month+1, day=1) - timedelta(days=1)
        q = q.filter(Seance.date >= str(debut), Seance.date <= str(fin))
    # semestre = tout sans filtre date

    seances = q.order_by(Seance.date, Seance.heure).all()
    return {"classe": u.classe, "vue": vue, "seances": [_fmt_seance(s) for s in seances]}

def _fmt_seance(s: Seance) -> dict:
    return {
        "id": s.id, "classe": s.classe, "filiere": s.filiere, "niveau": s.niveau,
        "semestre": s.semestre, "ue": s.ue, "module": s.module, "prof": s.prof,
        "date": s.date, "heure": s.heure, "duree": s.duree,
        "heures_prevues": s.heures_prevues, "heures_faites": s.heures_faites,
        "heures_restantes": s.heures_restantes,
        "salle": s.salle_nom, "site": s.site,
        "statut": s.statut, "note": s.note,
    }

@app.patch("/planning/seance/{seance_id}", tags=["Planning"])
def update_seance(
    seance_id: int, data: SeanceUpdate,
    u: User = Depends(require_admin), db: Session = Depends(get_db),
):
    """Modifier une séance (annuler, reporter, changer salle/date/heure). Mise à jour temps réel."""
    s = db.query(Seance).filter(Seance.id == seance_id).first()
    if not s: raise HTTPException(404, "Séance introuvable")

    if data.ue      is not None: s.ue      = data.ue
    if data.module  is not None: s.module  = data.module
    if data.prof    is not None: s.prof    = data.prof
    if data.date    is not None: s.date    = data.date
    if data.heure   is not None: s.heure   = data.heure
    if data.duree   is not None: s.duree   = data.duree
    if data.note    is not None: s.note    = data.note
    if data.statut  is not None:
        statuts_valides = {"programme", "annule", "reporte", "en_ligne"}
        if data.statut not in statuts_valides:
            raise HTTPException(400, f"Statut invalide : {statuts_valides}")
        # Si séance effectuée, décrémenter les heures restantes
        if data.statut == "programme" and s.statut != "programme":
            s.heures_faites = min(s.heures_prevues, s.heures_faites + (s.duree or 3.0))
        s.statut = data.statut

    s.updated_at = datetime.utcnow()
    db.commit()

    # ── Notification → étudiants de la classe ───────────────────────────────
    statut_msg = {
        "annule":    f"❌ Cours annulé : « {s.module} » ({s.date or 'date à confirmer'})",
        "reporte":   f"⏸️ Cours reporté : « {s.module} » ({s.date or 'date à confirmer'})",
        "en_ligne":  f"💻 Cours en ligne : « {s.module} » ({s.date or 'date à confirmer'})",
        "programme": f"📅 Cours reprogrammé : « {s.module} » le {s.date or '?'} à {s.heure or '?'}",
    }
    if data.statut or data.date or data.heure or data.salle_id:
        ids_etu = _ids_classe(db, s.classe)
        if ids_etu:
            if data.statut and data.statut in statut_msg:
                msg = statut_msg[data.statut]
                notif_titre = f"Planning {s.classe} modifié"
            else:
                msg = f"📅 Modification planning {s.classe} : « {s.module} »"
                if data.date:  msg += f" — Nouvelle date : {data.date}"
                if data.heure: msg += f" à {data.heure}"
                notif_titre = f"Planning {s.classe} mis à jour"
            if data.note: msg += f" — ℹ️ {data.note}"
            _notifier(
                db, ids_etu,
                type_="planning_modif",
                titre=notif_titre,
                message=msg,
                ref_id=s.id, ref_type="seance",
            )
    # ────────────────────────────────────────────────────────────────────────

    return {"message": "Séance mise à jour ✅", "seance": _fmt_seance(s)}

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  INFOS — STYLE RÉSEAU SOCIAL                                             ║
# ╚══════════════════════════════════════════════════════════════════════════╝

EMOJIS_VALIDES = {"👍","❤️","😂","😮","😢","👏","🔥","👀"}

@app.post("/infos", tags=["Infos"])
async def publier_info(
    titre:          str = None,
    description:    Optional[str] = None,
    lien:           Optional[str] = None,
    date_evenement: Optional[str] = None,
    cible:          str = "tous",
    image:          Optional[UploadFile] = File(None),
    video:          Optional[UploadFile] = File(None),
    u: User = Depends(require_admin), db: Session = Depends(get_db),
):
    """
    Publier une information officielle avec image/vidéo uploadées (pas des URLs).
    Réservé aux admins. Cible : tous | <code_filiere> | site_<SITE>
    """
    if not titre:
        raise HTTPException(400, "Le titre est obligatoire")

    # Lire et encoder l'image en base64
    image_data = image_mime = None
    if image and image.filename:
        img_bytes = await image.read()
        if len(img_bytes) > 10 * 1024 * 1024:
            raise HTTPException(400, "Image trop lourde (max 10 Mo)")
        import base64
        image_data = base64.b64encode(img_bytes).decode()
        image_mime = image.content_type or "image/jpeg"

    # Lire et encoder la vidéo en base64
    video_data = video_mime = None
    if video and video.filename:
        vid_bytes = await video.read()
        if len(vid_bytes) > 50 * 1024 * 1024:
            raise HTTPException(400, "Vidéo trop lourde (max 50 Mo)")
        import base64
        video_data = base64.b64encode(vid_bytes).decode()
        video_mime = video.content_type or "video/mp4"

    info = Info(
        titre=titre.strip(), description=description,
        image_data=image_data, image_mimetype=image_mime,
        video_data=video_data, video_mimetype=video_mime,
        lien=lien, date_evenement=date_evenement,
        cible=cible, user_id=u.id,
    )
    db.add(info); db.commit(); db.refresh(info)

    # ── Notification → utilisateurs ciblés ──────────────────────────────────
    ids_dest = _ids_cible_info(db, cible)
    if ids_dest:
        cible_label = "tout le monde" if cible == "tous" else (
            f"filière {cible}" if not cible.startswith("site_") else cible.replace("site_", "site ")
        )
        _notifier(
            db, ids_dest,
            type_="info_nouvelle",
            titre=f"📣 {titre}",
            message=f"Nouvelle information publiée ({cible_label}) : « {titre} »" +
                    (f" — {description[:80]}…" if description and len(description) > 80 else
                     f" — {description}" if description else ""),
            ref_id=info.id, ref_type="info",
        )
    # ────────────────────────────────────────────────────────────────────────

    return {"message": "Information publiée ✅", "id": info.id}

@app.get("/infos", tags=["Infos"])
def get_infos(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """
    Flux d'infos filtré selon le profil de l'utilisateur connecté.
    Chaque info inclut les compteurs de réactions.
    """
    current_user = None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        mat = payload.get("sub")
        if mat: current_user = db.query(User).filter(User.matricule == mat).first()
    except Exception:
        pass

    infos = db.query(Info).order_by(Info.created_at.desc()).all()

    def _visible(info: Info) -> bool:
        if info.cible == "tous": return True
        if not current_user: return False
        if current_user.role in ROLES_ADMIN: return True
        if info.cible == current_user.filiere: return True
        if info.cible == f"site_{current_user.filiere}": return True
        return False

    def _reactions(info: Info) -> dict:
        compteur = {}
        mon_emoji = None
        for r in info.reactions:
            compteur[r.emoji] = compteur.get(r.emoji, 0) + 1
            if current_user and r.user_id == current_user.id:
                mon_emoji = r.emoji
        return {"compteur": compteur, "total": sum(compteur.values()), "mon_emoji": mon_emoji}

    result = []
    for info in infos:
        if not _visible(info): continue
        reac = _reactions(info)
        result.append({
            "id":             info.id,
            "titre":          info.titre,
            "description":    info.description,
            # Champs de présence (utilisés par le frontend pour décider d'afficher)
            "has_image":      bool(info.image_data),
            "has_video":      bool(info.video_data),
            "image_mimetype": info.image_mimetype,
            "video_mimetype": info.video_mimetype,
            # URLs de téléchargement (pour <img src> et <video src>)
            "image_url":      f"/infos/{info.id}/image" if info.image_data else None,
            "video_url":      f"/infos/{info.id}/video" if info.video_data else None,
            "lien":           info.lien,
            "date_evenement": info.date_evenement,
            "cible":          info.cible,
            "auteur":         f"{info.auteur.prenom} {info.auteur.nom}" if info.auteur else "Admin",
            "created_at":     info.created_at.isoformat(),
            # Réactions : deux formats pour compatibilité frontend
            "reactions":       reac["compteur"],       # dict { "👍": 3, "❤️": 1 }
            "reactions_count": reac["compteur"],       # alias utilisé par le frontend
            "total_reactions": reac["total"],
            "mon_emoji":       reac["mon_emoji"],
        })
    return result

@app.get("/infos/{info_id}/image", tags=["Infos"])
def get_info_image(info_id: int, db: Session = Depends(get_db)):
    """Retourne l'image d'une info en binaire."""
    import base64
    info = db.query(Info).filter(Info.id == info_id).first()
    if not info or not info.image_data:
        raise HTTPException(404, "Image introuvable")
    return Response(
        content=base64.b64decode(info.image_data),
        media_type=info.image_mimetype or "image/jpeg",
    )

@app.get("/infos/{info_id}/video", tags=["Infos"])
def get_info_video(info_id: int, db: Session = Depends(get_db)):
    """Retourne la vidéo d'une info en binaire."""
    import base64
    info = db.query(Info).filter(Info.id == info_id).first()
    if not info or not info.video_data:
        raise HTTPException(404, "Vidéo introuvable")
    return Response(
        content=base64.b64decode(info.video_data),
        media_type=info.video_mimetype or "video/mp4",
    )

@app.post("/infos/{info_id}/reaction", tags=["Infos"])
def reagir_info(
    info_id: int, data: ReactionCreate,
    u: User = Depends(get_current_active_user), db: Session = Depends(get_db),
):
    """
    Ajouter ou changer sa réaction emoji sur une info.
    Un seul emoji par utilisateur par info. Même emoji = retirer la réaction.
    Emojis : 👍 ❤️ 😂 😮 😢 👏 🔥 👀
    """
    if data.emoji not in EMOJIS_VALIDES:
        raise HTTPException(400, f"Emoji invalide. Emojis acceptés : {EMOJIS_VALIDES}")
    info = db.query(Info).filter(Info.id == info_id).first()
    if not info: raise HTTPException(404, "Info introuvable")

    existante = db.query(InfoReaction).filter(
        InfoReaction.info_id == info_id, InfoReaction.user_id == u.id
    ).first()

    if existante:
        if existante.emoji == data.emoji:
            db.delete(existante); db.commit()
            return {"message": "Réaction retirée", "emoji": None}
        existante.emoji = data.emoji; db.commit()
        return {"message": "Réaction modifiée", "emoji": data.emoji}
    else:
        reac = InfoReaction(info_id=info_id, user_id=u.id, emoji=data.emoji)
        db.add(reac); db.commit()
        _xp(u, 1, db)
        return {"message": "Réaction ajoutée ✅", "emoji": data.emoji}

@app.delete("/infos/{info_id}", tags=["Infos"])
def delete_info(info_id: int, u: User = Depends(require_admin), db: Session = Depends(get_db)):
    info = db.query(Info).filter(Info.id == info_id).first()
    if not info: raise HTTPException(404, "Info introuvable")
    db.delete(info); db.commit()
    return {"message": f"Info #{info_id} supprimée"}

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  NOTIFICATIONS                                                           ║
# ╚══════════════════════════════════════════════════════════════════════════╝

@app.get("/notifications", tags=["Notifications"])
def get_notifications(
    non_lues_seulement: bool = False,
    limite: int = 50,
    u: User = Depends(get_current_active_user), db: Session = Depends(get_db),
):
    """
    Retourne les notifications de l'utilisateur connecté.
    - non_lues_seulement=true → uniquement les non lues
    - limite → nombre max de notifications (défaut 50)
    Inclut le compteur de non lues pour le badge dans l'app.
    """
    q = db.query(Notification).filter(Notification.user_id == u.id)
    if non_lues_seulement:
        q = q.filter(Notification.lue == False)
    notifs = q.order_by(Notification.created_at.desc()).limit(limite).all()
    total_non_lues = db.query(Notification).filter(
        Notification.user_id == u.id, Notification.lue == False
    ).count()
    notifs_list = [{
        "id":         n.id,
        "type":       n.type,
        "titre":      n.titre,
        "message":    n.message,
        "lue":        n.lue,
        "ref_id":     n.ref_id,
        "ref_type":   n.ref_type,
        "created_at": n.created_at.isoformat(),
    } for n in notifs]
    # Retourne la liste plate directement + métadonnées dans un format
    # compatible avec le frontend (qui itère sur la liste directement)
    return notifs_list

@app.patch("/notifications/{notif_id}/lue", tags=["Notifications"])
def marquer_lue(notif_id: int, u: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Marquer une notification comme lue."""
    n = db.query(Notification).filter(Notification.id == notif_id, Notification.user_id == u.id).first()
    if not n: raise HTTPException(404, "Notification introuvable")
    n.lue = True; db.commit()
    return {"message": "Notification marquée comme lue"}

@app.patch("/notifications/lues", tags=["Notifications"])
@app.patch("/notifications/toutes-lues", tags=["Notifications"])
def tout_marquer_lu(u: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Marquer toutes les notifications de l'utilisateur comme lues.
    Accessible via /notifications/lues ou /notifications/toutes-lues (alias frontend).
    """
    db.query(Notification).filter(
        Notification.user_id == u.id, Notification.lue == False
    ).update({"lue": True})
    db.commit()
    return {"message": "Toutes les notifications marquées comme lues ✅"}

@app.delete("/notifications/anciennes", tags=["Notifications"])
def supprimer_anciennes(
    jours: int = 30,
    u: User = Depends(get_current_active_user), db: Session = Depends(get_db),
):
    """Supprimer les notifications lues de plus de N jours (défaut 30)."""
    limite = datetime.utcnow() - timedelta(days=jours)
    db.query(Notification).filter(
        Notification.user_id == u.id,
        Notification.lue == True,
        Notification.created_at < limite,
    ).delete()
    db.commit()
    return {"message": f"Notifications lues de plus de {jours} jours supprimées"}
