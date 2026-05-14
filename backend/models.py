"""
CampusVoice — Modèles SQLAlchemy v3.0
Mis à jour par Kenny TRIGO :
  - User       : matricule = identifiant principal, email optionnel
  - Signalement: champs IA (decision_strategique, action_concrete, resume_ia, ...)
  - Vote, Satisfaction : CDC §9.2 & §9.3
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id           = Column(Integer, primary_key=True, index=True)
    matricule    = Column(String, unique=True, index=True, nullable=False)  # Identifiant principal AFI
    email        = Column(String, unique=True, index=True, nullable=True)   # Auto-généré, non utilisé pour login
    nom          = Column(String, nullable=False)
    prenom       = Column(String, nullable=False)
    mot_de_passe = Column(String, nullable=False)
    role         = Column(String, default="etudiant")  # etudiant | admin | admin_general

    # Profil complet (CDC §6.2)
    filiere      = Column(String, nullable=True)   # ex: Informatique
    niveau       = Column(String, nullable=True)   # ex: Master 2
    classe       = Column(String, nullable=True)   # ex: M2-AFI
    photo_url    = Column(String, nullable=True)

    # Statut du compte
    suspendu     = Column(Boolean, default=False)  # True = compte suspendu, accès bloqué

    # Gamification (CDC §6.2 Badges)
    xp           = Column(Integer, default=0)
    badges       = Column(String, default="")      # CSV : "etudiant_actif,super_contributeur"

    created_at   = Column(DateTime, default=datetime.utcnow)

    # Relations
    signalements  = relationship("Signalement",  back_populates="auteur")
    notes         = relationship("Note",         back_populates="etudiant")
    commentaires  = relationship("Commentaire",  back_populates="auteur")
    votes         = relationship("Vote",         back_populates="votant")
    satisfactions = relationship("Satisfaction", back_populates="etudiant")


class Signalement(Base):
    __tablename__ = "signalements"

    id          = Column(Integer, primary_key=True, index=True)
    titre       = Column(String, nullable=False)
    description = Column(String, nullable=False)
    categorie   = Column(String, nullable=False)
    statut      = Column(String, default="en_attente")
    # Statuts : en_attente | en_cours | pris_en_charge | resolu

    score_ia    = Column(Float,   default=0.0)
    likes       = Column(Integer, default=0)

    # Champs IA Kenny
    score_emotionnel     = Column(Integer, default=0)
    emotion_dominante    = Column(String,  default="neutre")
    niveau_urgence       = Column(Integer, default=0)        # 0-5
    categorie_auto       = Column(Boolean, default=False)    # True si l'IA a catégorisé
    confiance_categorie  = Column(Float,   default=0.0)

    # Décisions IA (Claude)
    decision_strategique = Column(Text, nullable=True)       # Recommandation pour l'admin
    action_concrete      = Column(Text, nullable=True)       # Action immédiate à réaliser
    resume_ia            = Column(Text, nullable=True)       # Résumé professionnel

    # Localisation & type (CDC §6.3)
    localisation         = Column(String, nullable=True)
    type_publication     = Column(String, default="public")  # public | prive | anonyme

    # Anonymat & visibilité
    anonyme              = Column(Boolean, default=False)    # True = nom masqué pour les étudiants
    visibilite           = Column(String,  default="tous")   # tous | filiere | admin

    created_at  = Column(DateTime, default=datetime.utcnow)
    user_id     = Column(Integer,  ForeignKey("users.id"))

    # Relations
    auteur        = relationship("User",        back_populates="signalements")
    commentaires  = relationship("Commentaire", back_populates="signalement")
    votes         = relationship("Vote",        back_populates="signalement")
    satisfactions = relationship("Satisfaction",back_populates="signalement")


class Note(Base):
    __tablename__ = "notes"

    id         = Column(Integer, primary_key=True, index=True)
    matiere    = Column(String,  nullable=False)
    note       = Column(Float,   nullable=False)
    semestre   = Column(String,  nullable=False)   # S1 | S2
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id    = Column(Integer,  ForeignKey("users.id"))

    etudiant = relationship("User", back_populates="notes")


class Commentaire(Base):
    __tablename__ = "commentaires"

    id             = Column(Integer, primary_key=True, index=True)
    contenu        = Column(String,  nullable=False)
    created_at     = Column(DateTime, default=datetime.utcnow)
    user_id        = Column(Integer,  ForeignKey("users.id"))
    signalement_id = Column(Integer,  ForeignKey("signalements.id"))

    auteur       = relationship("User",        back_populates="commentaires")
    signalement  = relationship("Signalement", back_populates="commentaires")


class Vote(Base):
    """Vote communautaire — CDC §9.2"""
    __tablename__ = "votes"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"),        nullable=False)
    signalement_id = Column(Integer, ForeignKey("signalements.id"), nullable=False)
    created_at     = Column(DateTime, default=datetime.utcnow)

    votant       = relationship("User",        back_populates="votes")
    signalement  = relationship("Signalement", back_populates="votes")


class Satisfaction(Base):
    """Avis post-résolution — CDC §9.3"""
    __tablename__ = "satisfactions"

    id                 = Column(Integer, primary_key=True, index=True)
    note_satisfaction  = Column(Integer, nullable=False)   # 1-5 étoiles
    avis               = Column(Text,    nullable=True)
    user_id            = Column(Integer, ForeignKey("users.id"),        nullable=False)
    signalement_id     = Column(Integer, ForeignKey("signalements.id"), nullable=False)
    created_at         = Column(DateTime, default=datetime.utcnow)

    etudiant     = relationship("User",        back_populates="satisfactions")
    signalement  = relationship("Signalement", back_populates="satisfactions")


# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  PLANNING                                                                ║
# ╚══════════════════════════════════════════════════════════════════════════╝

class Salle(Base):
    """Salle de cours — gérée par l'admin, dispatchée par l'IA selon capacité"""
    __tablename__ = "salles"

    id        = Column(Integer, primary_key=True, index=True)
    site      = Column(String, nullable=False)   # AFI_SIEGE | AFITECH | AFIPOINT_E | LYCEE
    nom       = Column(String, nullable=False)   # ex: Salle 05
    capacite  = Column(Integer, default=30)
    active    = Column(Boolean, default=True)

    seances   = relationship("Seance", back_populates="salle_obj")


class Seance(Base):
    """Séance de cours dans le planning"""
    __tablename__ = "seances"

    id               = Column(Integer, primary_key=True, index=True)
    classe           = Column(String,  nullable=False)   # ex: M2-SRT
    filiere          = Column(String,  nullable=False)   # code court
    niveau           = Column(String,  nullable=False)   # L1..M2
    semestre         = Column(String,  nullable=False)   # S1 | S2
    ue               = Column(String,  nullable=False)   # Unité d'enseignement
    module           = Column(String,  nullable=False)   # Nom du module
    prof             = Column(String,  nullable=True)    # Nom du professeur
    date             = Column(String,  nullable=True)    # YYYY-MM-DD
    heure            = Column(String,  nullable=True)    # HH:MM
    duree            = Column(Float,   default=3.0)      # durée en heures
    heures_prevues   = Column(Float,   default=0.0)      # total heures du module
    heures_faites    = Column(Float,   default=0.0)      # heures déjà effectuées
    salle_id         = Column(Integer, ForeignKey("salles.id"), nullable=True)
    statut           = Column(String,  default="programme")  # programme|annule|reporte|en_ligne
    note             = Column(Text,    nullable=True)    # motif annulation / info
    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    salle_obj        = relationship("Salle", back_populates="seances")

    @property
    def heures_restantes(self):
        return max(0, self.heures_prevues - self.heures_faites)

    @property
    def salle_nom(self):
        return self.salle_obj.nom if self.salle_obj else None

    @property
    def site(self):
        return self.salle_obj.site if self.salle_obj else None


# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  INFOS                                                                   ║
# ╚══════════════════════════════════════════════════════════════════════════╝

class Info(Base):
    """Information officielle publiée par un admin — style réseau social"""
    __tablename__ = "infos"

    id              = Column(Integer, primary_key=True, index=True)
    titre           = Column(String,  nullable=False)
    description     = Column(Text,    nullable=True)
    image_data      = Column(Text,    nullable=True)   # base64 encodé
    image_mimetype  = Column(String,  nullable=True)   # image/jpeg | image/png | image/gif
    video_data      = Column(Text,    nullable=True)   # base64 encodé
    video_mimetype  = Column(String,  nullable=True)   # video/mp4 | video/webm
    lien            = Column(String,  nullable=True)   # lien externe optionnel
    date_evenement  = Column(String,  nullable=True)   # date optionnelle de l'événement
    cible           = Column(String,  default="tous")  # tous | <code_filiere> | site_<SITE>
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at      = Column(DateTime, default=datetime.utcnow)

    auteur          = relationship("User")
    reactions       = relationship("InfoReaction", back_populates="info", cascade="all, delete-orphan")


class InfoReaction(Base):
    """Réaction emoji d'un utilisateur sur une info — un seul emoji par user par info"""
    __tablename__ = "info_reactions"

    id         = Column(Integer, primary_key=True, index=True)
    info_id    = Column(Integer, ForeignKey("infos.id"),  nullable=False)
    user_id    = Column(Integer, ForeignKey("users.id"),  nullable=False)
    emoji      = Column(String,  nullable=False)   # 👍 ❤️ 😂 😮 😢 👏
    created_at = Column(DateTime, default=datetime.utcnow)

    info       = relationship("Info",  back_populates="reactions")
    user_obj   = relationship("User")


# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  NOTIFICATIONS                                                           ║
# ╚══════════════════════════════════════════════════════════════════════════╝

class Notification(Base):
    """
    Notification en base pour un utilisateur.
    Types :
      signalement_nouveau   — nouvel signalement publié (→ admins)
      signalement_statut    — statut du signalement mis à jour (→ auteur)
      info_nouvelle         — nouvelle information publiée (→ utilisateurs ciblés)
      planning_modif        — séance modifiée/annulée/reportée (→ étudiants de la classe)
    """
    __tablename__ = "notifications"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    type       = Column(String,  nullable=False)   # voir types ci-dessus
    titre      = Column(String,  nullable=False)
    message    = Column(Text,    nullable=False)
    lue        = Column(Boolean, default=False)
    # Référence optionnelle vers l'objet source
    ref_id     = Column(Integer, nullable=True)    # id du signalement / info / séance
    ref_type   = Column(String,  nullable=True)    # signalement | info | seance
    created_at = Column(DateTime, default=datetime.utcnow)

    destinataire = relationship("User")
