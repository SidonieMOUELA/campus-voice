from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

# --- Modèle User ---
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String, nullable=False)
    prenom = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    mot_de_passe = Column(String, nullable=False)
    role = Column(String, default="etudiant")  # etudiant | admin
    created_at = Column(DateTime, default=datetime.utcnow)

    signalements = relationship("Signalement", back_populates="auteur")
    notes = relationship("Note", back_populates="etudiant")

# --- Modèle Signalement ---
class Signalement(Base):
    __tablename__ = "signalements"

    id = Column(Integer, primary_key=True, index=True)
    titre = Column(String, nullable=False)
    description = Column(String, nullable=False)
    categorie = Column(String, nullable=False)  # wifi | salle | admin | autre
    statut = Column(String, default="en_attente")  # en_attente | pris_en_charge | resolu
    score_ia = Column(Float, default=0.0)
    likes = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))

    auteur = relationship("User", back_populates="signalements")

# --- Modèle Note ---
class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    ma