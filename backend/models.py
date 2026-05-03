from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String, nullable=False)
    prenom = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    mot_de_passe = Column(String, nullable=False)
    role = Column(String, default="etudiant")
    created_at = Column(DateTime, default=datetime.utcnow)

    signalements = relationship("Signalement", back_populates="auteur")
    notes = relationship("Note", back_populates="etudiant")

class Signalement(Base):
    __tablename__ = "signalements"

    id = Column(Integer, primary_key=True, index=True)
    titre = Column(String, nullable=False)
    description = Column(String, nullable=False)
    categorie = Column(String, nullable=False)
    statut = Column(String, default="en_attente")
    score_ia = Column(Float, default=0.0)
    likes = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))

    auteur = relationship("User", back_populates="signalements")

class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    matiere = Column(String, nullable=False)
    note = Column(Float, nullable=False)
    semestre = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))

    etudiant = relationship("User", back_populates="notes")