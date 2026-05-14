"""
CampusVoice — Script d'initialisation du premier compte Admin Général
Usage : docker-compose exec backend python init_admin.py
"""

import os, sys
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext
from models import Base, User

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ DATABASE_URL manquante dans .env"); sys.exit(1)

engine       = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
pwd_context  = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

Base.metadata.create_all(bind=engine)

db = SessionLocal()

# ── Paramètres du compte admin général ───────────────────────────────────────
MATRICULE  = "ADMIN001"
NOM        = "Administrateur"
PRENOM     = "Général"
EMAIL      = "admin@afi.sn"
MOT_DE_PASSE = "Admin@2026!"   # ← Change ce mot de passe après la première connexion

# ── Vérification ─────────────────────────────────────────────────────────────
existing = db.query(User).filter(User.matricule == MATRICULE).first()
if existing:
    print(f"⚠️  Le compte {MATRICULE} existe déjà (rôle : {existing.role})")
    if existing.role != "admin_general":
        existing.role = "admin_general"
        db.commit()
        print(f"✅ Rôle mis à jour → admin_general")
    sys.exit(0)

# ── Création ─────────────────────────────────────────────────────────────────
admin = User(
    matricule    = MATRICULE,
    nom          = NOM,
    prenom       = PRENOM,
    email        = EMAIL,
    mot_de_passe = pwd_context.hash(MOT_DE_PASSE[:72]),
    role         = "admin_general",
)
db.add(admin)
db.commit()

print("=" * 50)
print("✅ Compte Admin Général créé avec succès !")
print(f"   Matricule : {MATRICULE}")
print(f"   Mot de passe : {MOT_DE_PASSE}")
print(f"   ⚠️  Changez le mot de passe après la première connexion !")
print("=" * 50)

db.close()
