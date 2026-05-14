"""
CampusVoice — Moteur IA
Auteur : Kenny TRIGO — IA + Notes
Hackathon AFI-TECH 2026

Ce module regroupe toutes les fonctionnalités d'intelligence artificielle :
  - Catégorisation automatique des signalements
  - Analyse émotionnelle (urgence, frustration, colère, satisfaction)
  - Détection de doublons par similarité textuelle
  - Calcul du score IA enrichi
  - Analyse de performance académique
  - Génération de recommandations IA
"""

import re
import math
from datetime import datetime
from typing import Optional


# ---------------------------------------------------------------------------
# 1. CATÉGORISATION AUTOMATIQUE
# ---------------------------------------------------------------------------

CATEGORIES_KEYWORDS = {
    "wifi": [
        "wifi", "wi-fi", "internet", "connexion", "réseau", "débit",
        "lent", "coupure", "signal", "router", "fibre", "haut débit",
        "bandwidth", "ping", "lag", "déconnecté", "hotspot",
    ],
    "salle": [
        "salle", "classe", "cours", "amphi", "amphithéâtre", "tableau",
        "chaise", "bureau", "projecteur", "vidéoprojecteur", "écran",
        "climatisation", "clim", "ventilation", "chaleur", "froid",
        "lumière", "éclairage", "porte", "fenêtre", "bruit", "acoustique",
        "prise", "électricité", "courant", "tableau blanc", "marqueur",
        "rétroprojecteur", "micro", "son", "sono",
    ],
    "admin": [
        "admin", "administration", "secrétariat", "bureau", "dossier",
        "inscription", "document", "certificat", "attestation", "diplôme",
        "relevé", "notes", "bulletin", "frais", "scolarité", "paiement",
        "bourse", "emploi du temps", "planning", "horaire", "professeur",
        "enseignant", "directeur", "chef", "service", "réponse", "lent",
        "délai", "attente", "queue", "traitement",
    ],
    "securite": [
        "sécurité", "danger", "risque", "accident", "chute", "blessure",
        "agression", "vol", "effraction", "caméra", "gardien", "vigile",
        "incendie", "feu", "fumée", "urgence", "police", "ambulance",
        "escalier", "rampe", "glissant", "cassé", "dangereux",
    ],
    "cafeteria": [
        "cafétéria", "restaurant", "cantine", "repas", "manger", "nourriture",
        "eau", "fontaine", "boisson", "hygiène", "propre", "sale", "odeur",
        "cuisine", "menu", "prix", "cher", "qualité",
    ],
    "sanitaire": [
        "toilette", "wc", "sanitaire", "lavabo", "robinet", "eau",
        "savon", "papier", "propreté", "nettoyage", "désinfection",
        "odeur", "hygiene", "douche",
    ],
    "bibliotheque": [
        "bibliothèque", "livre", "bouquin", "ouvrage", "lecture",
        "salle de lecture", "silence", "ordinateur", "imprimante",
        "scanner", "photocopie", "ressource", "documentation",
    ],
    "autre": [],  # fallback
}


def categoriser_signalement(titre: str, description: str) -> dict:
    """
    Détecte automatiquement la catégorie d'un signalement à partir du texte.
    Retourne la catégorie détectée + un score de confiance (0-1).
    """
    texte = (titre + " " + description).lower()
    # Nettoyer les accents pour la comparaison
    texte = _normaliser(texte)

    scores = {}
    for categorie, keywords in CATEGORIES_KEYWORDS.items():
        if categorie == "autre":
            continue
        score = 0
        for kw in keywords:
            kw_norm = _normaliser(kw)
            # Correspondance exacte = 2 pts, sous-chaîne = 1 pt
            if re.search(r'\b' + re.escape(kw_norm) + r'\b', texte):
                score += 2
            elif kw_norm in texte:
                score += 1
        scores[categorie] = score

    meilleure_cat = max(scores, key=scores.get) if scores else "autre"
    meilleur_score = scores.get(meilleure_cat, 0)

    if meilleur_score == 0:
        meilleure_cat = "autre"
        confiance = 0.0
    else:
        total = sum(scores.values()) or 1
        confiance = round(meilleur_score / total, 2)

    return {
        "categorie_detectee": meilleure_cat,
        "confiance": confiance,
        "scores_par_categorie": scores,
    }


# ---------------------------------------------------------------------------
# 2. ANALYSE ÉMOTIONNELLE
# ---------------------------------------------------------------------------

EMOTIONS = {
    "urgence": {
        "keywords": [
            "urgent", "urgence", "immédiatement", "maintenant", "vite",
            "rapidement", "critique", "sos", "danger", "grave",
            "impossible", "bloqué", "bloque", "empêche", "empêché",
            "tout de suite", "au plus tôt", "dès que possible",
        ],
        "poids": 3,
    },
    "frustration": {
        "keywords": [
            "frustrant", "frustré", "agacé", "énervé", "marre", "ras le bol",
            "insupportable", "inacceptable", "encore", "toujours pareil",
            "jamais réglé", "jamais résolu", "personne ne fait rien",
            "inutile", "nul", "catastrophique", "lamentable", "honteux",
            "scandaleux", "inadmissible", "décevant", "déçu",
        ],
        "poids": 2,
    },
    "colere": {
        "keywords": [
            "colère", "énerver", "furieux", "inacceptable", "révoltant",
            "outrageux", "dégoutant", "dégueulasse", "nul", "incompétent",
            "on s'en fout", "rien ne change", "c'est nul", "honteux",
            "plainte", "signaler", "porter plainte",
        ],
        "poids": 2,
    },
    "satisfaction": {
        "keywords": [
            "merci", "bravo", "bien", "super", "excellent", "parfait",
            "satisfait", "content", "heureux", "félicitations", "top",
            "génial", "formidable", "amélioration", "mieux", "progrès",
        ],
        "poids": -1,  # Réduit la priorité (signalement positif)
    },
}


def analyser_emotion(titre: str, description: str) -> dict:
    """
    Analyse les émotions dans le texte du signalement.
    Retourne : émotion dominante, score émotionnel total, détail par émotion.
    """
    texte = _normaliser(titre + " " + description)
    resultats = {}
    score_total = 0

    for emotion, config in EMOTIONS.items():
        count = 0
        mots_trouves = []
        for kw in config["keywords"]:
            kw_norm = _normaliser(kw)
            if kw_norm in texte:
                count += 1
                mots_trouves.append(kw)
        resultats[emotion] = {
            "detecte": count > 0,
            "occurrences": count,
            "mots_trouves": mots_trouves,
        }
        score_total += count * config["poids"]

    # Émotion dominante (hors satisfaction négative)
    emotions_positives = {k: v for k, v in resultats.items()
                          if k != "satisfaction" and v["occurrences"] > 0}
    emotion_dominante = (
        max(emotions_positives, key=lambda k: emotions_positives[k]["occurrences"])
        if emotions_positives else "neutre"
    )

    # Niveau d'urgence : 0-5
    niveau_urgence = min(5, max(0, score_total))

    return {
        "emotion_dominante": emotion_dominante,
        "score_emotionnel": score_total,
        "niveau_urgence": niveau_urgence,
        "detail": resultats,
    }


# ---------------------------------------------------------------------------
# 3. SCORE IA ENRICHI
# ---------------------------------------------------------------------------

def calculer_score_ia(
    likes: int,
    created_at: datetime,
    score_emotionnel: int = 0,
    nb_commentaires: int = 0,
) -> float:
    """
    Score IA enrichi par Kenny :
      Base (Modibo) : (likes × 2) / âge_jours
      Enrichissement Kenny : + poids émotionnel + activité commentaires

    Formule complète :
      score = (likes × 2 + emotion × 1.5 + commentaires × 0.5) / âge_jours
    """
    age_jours = max(1, (datetime.utcnow() - created_at).total_seconds() / 86400)
    score = (likes * 2 + max(0, score_emotionnel) * 1.5 + nb_commentaires * 0.5) / age_jours
    return round(score, 2)


# ---------------------------------------------------------------------------
# 4. DÉTECTION DE DOUBLONS
# ---------------------------------------------------------------------------

def _tokeniser(texte: str) -> set:
    """Transforme un texte en ensemble de tokens normalisés."""
    texte = _normaliser(texte)
    tokens = re.findall(r'\b\w{3,}\b', texte)  # Mots de 3+ caractères
    # Supprimer les stop words courants
    stop_words = {
        "les", "des", "une", "est", "que", "qui", "pas", "par",
        "pour", "dans", "sur", "avec", "son", "ses", "notre",
        "mais", "donc", "car", "bien", "tout", "plus", "très",
        "aussi", "quand", "comme", "cette", "depuis", "avoir",
    }
    return {t for t in tokens if t not in stop_words}


def calculer_similarite(texte1: str, texte2: str) -> float:
    """
    Similarité de Jaccard entre deux textes.
    Retourne un score entre 0 (aucune similarité) et 1 (identiques).
    """
    tokens1 = _tokeniser(texte1)
    tokens2 = _tokeniser(texte2)
    if not tokens1 or not tokens2:
        return 0.0
    intersection = tokens1 & tokens2
    union = tokens1 | tokens2
    return round(len(intersection) / len(union), 3)


def detecter_doublons(
    nouveau_titre: str,
    nouvelle_description: str,
    signalements_existants: list,
    seuil: float = 0.35,
) -> list:
    """
    Compare un nouveau signalement aux signalements existants.
    Retourne la liste des doublons potentiels (similarité > seuil).

    Args:
        seuil: 0.35 = au moins 35% de mots en commun → doublon probable
    """
    texte_nouveau = nouveau_titre + " " + nouvelle_description
    doublons = []

    for s in signalements_existants:
        texte_existant = s.get("titre", "") + " " + s.get("description", "")
        similarite = calculer_similarite(texte_nouveau, texte_existant)
        if similarite >= seuil:
            doublons.append({
                "id": s.get("id"),
                "titre": s.get("titre"),
                "similarite": similarite,
                "statut": s.get("statut"),
            })

    # Trier par similarité décroissante
    doublons.sort(key=lambda x: x["similarite"], reverse=True)
    return doublons


# ---------------------------------------------------------------------------
# 5. ANALYSE DE PERFORMANCE ACADÉMIQUE
# ---------------------------------------------------------------------------

def analyser_performance_notes(notes: list) -> dict:
    """
    Analyse les notes d'un étudiant et génère des recommandations IA.

    Args:
        notes: liste de dicts {matiere, note, semestre}

    Returns:
        Analyse complète avec tendances, points forts/faibles, recommandations
    """
    if not notes:
        return {"message": "Aucune note à analyser."}

    # --- Grouper par semestre et matière ---
    par_semestre = {}
    par_matiere = {}

    for n in notes:
        s = n.get("semestre", "S?")
        m = n.get("matiere", "?")
        val = n.get("note", 0)

        par_semestre.setdefault(s, []).append(val)
        par_matiere.setdefault(m, []).append(val)

    # --- Moyennes ---
    moyennes_semestre = {
        s: round(sum(v) / len(v), 2)
        for s, v in par_semestre.items()
    }
    moyennes_matiere = {
        m: round(sum(v) / len(v), 2)
        for m, v in par_matiere.items()
    }
    moyenne_generale = round(
        sum(n.get("note", 0) for n in notes) / len(notes), 2
    )

    # --- Points forts / faibles ---
    if moyennes_matiere:
        meilleure_matiere = max(moyennes_matiere, key=moyennes_matiere.get)
        pire_matiere = min(moyennes_matiere, key=moyennes_matiere.get)
    else:
        meilleure_matiere = pire_matiere = None

    # --- Tendance entre semestres ---
    tendance = "stable"
    semestres_tries = sorted(moyennes_semestre.keys())
    if len(semestres_tries) >= 2:
        diff = (moyennes_semestre[semestres_tries[-1]]
                - moyennes_semestre[semestres_tries[-2]])
        if diff >= 1.5:
            tendance = "en_hausse"
        elif diff <= -1.5:
            tendance = "en_baisse"

    # --- Niveau global ---
    if moyenne_generale >= 16:
        niveau = "excellent"
    elif moyenne_generale >= 14:
        niveau = "très_bien"
    elif moyenne_generale >= 12:
        niveau = "bien"
    elif moyenne_generale >= 10:
        niveau = "passable"
    else:
        niveau = "insuffisant"

    # --- Recommandations IA ---
    recommandations = _generer_recommandations(
        niveau=niveau,
        tendance=tendance,
        pire_matiere=pire_matiere,
        meilleure_matiere=meilleure_matiere,
        moyenne_generale=moyenne_generale,
        moyennes_matiere=moyennes_matiere,
    )

    return {
        "moyenne_generale": moyenne_generale,
        "niveau": niveau,
        "tendance": tendance,
        "moyennes_par_semestre": moyennes_semestre,
        "moyennes_par_matiere": moyennes_matiere,
        "meilleure_matiere": {
            "nom": meilleure_matiere,
            "moyenne": moyennes_matiere.get(meilleure_matiere),
        } if meilleure_matiere else None,
        "matiere_a_ameliorer": {
            "nom": pire_matiere,
            "moyenne": moyennes_matiere.get(pire_matiere),
        } if pire_matiere else None,
        "recommandations": recommandations,
        "nombre_notes": len(notes),
    }


def _generer_recommandations(
    niveau: str,
    tendance: str,
    pire_matiere: Optional[str],
    meilleure_matiere: Optional[str],
    moyenne_generale: float,
    moyennes_matiere: dict,
) -> list:
    """Génère des recommandations personnalisées selon le profil de l'étudiant."""
    recs = []

    if tendance == "en_baisse":
        recs.append({
            "type": "alerte",
            "message": f"⚠️ Ta moyenne est en baisse entre les semestres. Identifie les matières qui te posent problème et consulte tes professeurs rapidement.",
        })
    elif tendance == "en_hausse":
        recs.append({
            "type": "encouragement",
            "message": "📈 Bravo ! Ta moyenne progresse entre les semestres. Continue sur cette lancée !",
        })

    if pire_matiere and moyennes_matiere.get(pire_matiere, 20) < 10:
        recs.append({
            "type": "action",
            "message": f"🎯 {pire_matiere} est ta matière la plus faible ({moyennes_matiere[pire_matiere]}/20). Prévois des séances de révision supplémentaires ou rejoins un groupe d'étude.",
        })
    elif pire_matiere and moyennes_matiere.get(pire_matiere, 20) < 12:
        recs.append({
            "type": "conseil",
            "message": f"📚 Porte attention à {pire_matiere} ({moyennes_matiere[pire_matiere]}/20). Une révision ciblée peut faire la différence.",
        })

    if meilleure_matiere and moyennes_matiere.get(meilleure_matiere, 0) >= 15:
        recs.append({
            "type": "encouragement",
            "message": f"⭐ Tu excelles en {meilleure_matiere} ({moyennes_matiere[meilleure_matiere]}/20). Tu pourrais aider tes camarades dans cette matière !",
        })

    if niveau == "insuffisant":
        recs.append({
            "type": "urgent",
            "message": "🚨 Ta moyenne générale est en dessous de 10/20. Consulte un conseiller pédagogique dès que possible pour un plan de rattrapage.",
        })
    elif niveau == "excellent":
        recs.append({
            "type": "félicitation",
            "message": f"🏆 Excellente performance ! Avec {moyenne_generale}/20 de moyenne, tu es dans le top de ta promotion. Vise les mentions !",
        })

    if not recs:
        recs.append({
            "type": "neutre",
            "message": f"📊 Moyenne générale de {moyenne_generale}/20. Continue tes efforts réguliers pour maintenir ce niveau.",
        })

    return recs


# ---------------------------------------------------------------------------
# 6. RAPPORT IA GLOBAL
# ---------------------------------------------------------------------------

def generer_rapport_ia(signalements: list) -> dict:
    """
    Génère un rapport IA global sur l'ensemble des signalements.
    Utilisé par le dashboard admin.
    """
    if not signalements:
        return {"message": "Aucune donnée disponible."}

    total = len(signalements)
    # Distribution par catégorie
    categories = {}
    for s in signalements:
        cat = s.get("categorie", "autre")
        categories[cat] = categories.get(cat, 0) + 1

    # Distribution par statut
    statuts = {}
    for s in signalements:
        st = s.get("statut", "en_attente")
        statuts[st] = statuts.get(st, 0) + 1

    # Catégorie la plus problématique
    cat_critique = max(categories, key=categories.get) if categories else None

    # Signalements haute priorité (score > 5)
    haute_priorite = [s for s in signalements if s.get("score_ia", 0) > 5]

    # Taux de résolution
    resolus = statuts.get("resolu", 0)
    taux_resolution = round(resolus / total * 100, 1) if total > 0 else 0

    # Recommandations stratégiques
    recommandations_admin = []
    if categories.get("wifi", 0) > total * 0.3:
        recommandations_admin.append("🌐 Plus de 30% des signalements concernent le WiFi. Une intervention infrastructure est prioritaire.")
    if taux_resolution < 30:
        recommandations_admin.append("⚡ Le taux de résolution est faible. Augmenter les ressources de traitement des incidents.")
    if len(haute_priorite) > 3:
        recommandations_admin.append(f"🚨 {len(haute_priorite)} signalements sont en haute priorité. Action immédiate recommandée.")

    return {
        "total_signalements": total,
        "taux_resolution": taux_resolution,
        "distribution_categories": categories,
        "distribution_statuts": statuts,
        "categorie_critique": cat_critique,
        "signalements_haute_priorite": len(haute_priorite),
        "recommandations_strategiques": recommandations_admin,
        "genere_le": datetime.utcnow().isoformat(),
    }


# ---------------------------------------------------------------------------
# UTILITAIRES
# ---------------------------------------------------------------------------

def _normaliser(texte: str) -> str:
    """Normalise le texte : minuscules, suppression des accents courants."""
    texte = texte.lower()
    remplacements = {
        'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
        'à': 'a', 'â': 'a', 'ä': 'a',
        'ù': 'u', 'û': 'u', 'ü': 'u',
        'î': 'i', 'ï': 'i',
        'ô': 'o', 'ö': 'o',
        'ç': 'c', 'ñ': 'n',
    }
    for acc, base in remplacements.items():
        texte = texte.replace(acc, base)
    return texte
