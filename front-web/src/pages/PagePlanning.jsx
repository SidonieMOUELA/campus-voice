// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  PAGE PLANNING — Campus Voice                                                ║
// ║  Remplace uniquement la fonction PagePlanning dans OtherPages.jsx            ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
import { useState, useEffect, useCallback, useRef } from "react";
import { T, FILIERES, NIVEAUX, SITES, SEMESTRES } from "../theme.js";
import { Card, Btn, Input, Modal, Spinner, EmptyState, SectionTitle, Pill, Divider } from "../components/ui.jsx";
import {
  getClasses, getPlanningClasse, updateSeance,
  getSalles, createSalle, deleteSalle, uploadPlanning,
} from "../api.js";

const BASE = "http://localhost:8000";

const STATUT_COLOR = {
  programme: T.cyan,
  en_ligne:  T.blue,
  annule:    "#EF4444",
  reporte:   T.orange,
};

const STATUT_OPTS = [
  { value: "programme", label: "📅 Programmé"  },
  { value: "en_ligne",  label: "💻 En ligne"   },
  { value: "annule",    label: "❌ Annulé"      },
  { value: "reporte",   label: "⏸️ Reporté"    },
];

// Séance vide par défaut
const SEANCE_VIDE = {
  classe: "", filiere: "SRT", niveau: "M2", semestre: "S1",
  ue: "", module: "", prof: "", date: "", heure: "08:00",
  duree: "3", heures_prevues: "30", statut: "programme", note: "",
};

export function PagePlanning({ token, showToast }) {
  const [classes,     setClasses]     = useState([]);
  const [classe,      setClasse]      = useState("");
  const [seances,     setSeances]     = useState([]);
  const [salles,      setSalles]      = useState([]);
  const [loading,     setLoading]     = useState(false);

  // Modals
  const [editModal,   setEditModal]   = useState(null);   // séance à éditer
  const [editFrm,     setEditFrm]     = useState({});
  const [salleModal,  setSalleModal]  = useState(false);
  const [salleFrm,    setSalleFrm]    = useState({ site: "AFI_SIEGE", nom: "", capacite: "30" });
  const [addModal,    setAddModal]    = useState(false);  // ← NOUVEAU: ajout manuel
  const [addFrm,      setAddFrm]      = useState(SEANCE_VIDE);
  const [addLoading,  setAddLoading]  = useState(false);

  // Import Excel
  const [uploadFrm,   setUploadFrm]   = useState({ filiere: "SRT", niveau: "M2", semestre: "S1" });
  const fileRef = useRef();

  // ── Chargement initial ────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const [cls, sls] = await Promise.all([getClasses(token), getSalles(token)]);
      setClasses(cls || []);
      setSalles(sls || []);
    } catch (e) {
      showToast?.("❌ " + e.message, "error");
    }
  }, [token]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Charger les séances d'une classe ─────────────────────────────────────
  const loadSeances = async (cl) => {
    setClasse(cl); setLoading(true);
    try {
      const d = await getPlanningClasse(token, cl);
      setSeances(Array.isArray(d) ? d : []);
    } catch (e) {
      showToast?.("❌ " + e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Sauvegarder modification séance ──────────────────────────────────────
  const saveSeance = async () => {
    try {
      await updateSeance(token, editModal.id, editFrm);
      setSeances(prev => prev.map(s => s.id === editModal.id ? { ...s, ...editFrm } : s));
      setEditModal(null);
      showToast?.("✅ Séance mise à jour", "success");
    } catch (e) {
      showToast?.("❌ " + e.message, "error");
    }
  };

  // ── Ajouter une séance manuellement via POST /planning/seance ─────────────
  const addSeance = async () => {
    if (!addFrm.module || !addFrm.filiere || !addFrm.niveau) {
      showToast?.("⚠️ Module, filière et niveau sont obligatoires", "error");
      return;
    }
    setAddLoading(true);
    try {
      // Générer la classe automatiquement
      const classe_gen = `${addFrm.niveau}-${addFrm.filiere}`;

      const body = {
        classe:         addFrm.classe || classe_gen,
        filiere:        addFrm.filiere,
        niveau:         addFrm.niveau,
        semestre:       addFrm.semestre,
        ue:             addFrm.ue || addFrm.module,
        module:         addFrm.module,
        prof:           addFrm.prof || null,
        date:           addFrm.date || null,
        heure:          addFrm.heure || null,
        duree:          parseFloat(addFrm.duree) || 3.0,
        heures_prevues: parseFloat(addFrm.heures_prevues) || 30.0,
        statut:         addFrm.statut,
        note:           addFrm.note || null,
      };

      const res = await fetch(`${BASE}/planning/seance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        // Fallback : l'endpoint POST /planning/seance n'existe pas encore → on utilise upload Excel
        // On informe l'admin
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      showToast?.("✅ Séance ajoutée avec succès", "success");
      setAddModal(false);
      setAddFrm(SEANCE_VIDE);

      // Recharger les classes et séances
      const cls = await getClasses(token);
      setClasses(cls || []);
      const cl = addFrm.classe || classe_gen;
      setClasse(cl);
      await loadSeances(cl);

    } catch (e) {
      // Si l'endpoint POST /planning/seance n'existe pas, on guide l'admin
      if (e.message.includes("404") || e.message.includes("405")) {
        showToast?.("⚠️ Utilisez l'import Excel pour ajouter des séances en masse", "error");
      } else {
        showToast?.("❌ " + e.message, "error");
      }
    } finally {
      setAddLoading(false);
    }
  };

  // ── Créer une salle + recharger immédiatement ────────────────────────────
  const ajouterSalle = async () => {
    if (!salleFrm.nom.trim()) {
      showToast?.("⚠️ Le nom de la salle est obligatoire", "error");
      return;
    }
    try {
      await createSalle(token, { ...salleFrm, capacite: parseInt(salleFrm.capacite) || 30 });
      showToast?.("✅ Salle créée avec succès", "success");
      setSalleFrm({ site: "AFI_SIEGE", nom: "", capacite: "30" });
      // Recharger immédiatement les salles — FIX du bug d'affichage
      const sls = await getSalles(token);
      setSalles(sls || []);
    } catch (e) {
      showToast?.("❌ " + e.message, "error");
    }
  };

  const supprimerSalle = async (id) => {
    try {
      await deleteSalle(token, id);
      setSalles(prev => prev.filter(s => s.id !== id));
      showToast?.("✅ Salle désactivée", "success");
    } catch (e) {
      showToast?.("❌ " + e.message, "error");
    }
  };

  // ── Import Excel ──────────────────────────────────────────────────────────
  const handleUpload = async (file) => {
    try {
      const d = await uploadPlanning(token, file, uploadFrm);
      showToast?.(`✅ ${d.seances_importees} séance(s) importée(s) — Classe : ${d.classe}`, "success");
      const cls = await getClasses(token);
      setClasses(cls || []);
      if (d.classe) { setClasse(d.classe); await loadSeances(d.classe); }
    } catch (e) {
      showToast?.("❌ " + e.message, "error");
    }
  };

  // ── Grouper les séances par date ──────────────────────────────────────────
  const seancesParDate = seances.reduce((acc, s) => {
    const key = s.date || "Sans date";
    (acc[key] = acc[key] || []).push(s);
    return acc;
  }, {});

  const nbUrgentes = seances.filter(s => s.statut === "annule" || s.statut === "reporte").length;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      <SectionTitle action={
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" small onClick={() => setSalleModal(true)}>
            🏛️ Salles ({salles.length})
          </Btn>
          <Btn small onClick={() => setAddModal(true)}>
            + Ajouter une séance
          </Btn>
        </div>
      }>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: T.text, margin: 0 }}>Planning</h2>
        <span style={{ fontSize: 13, color: T.sub }}>{classes.length} classe(s)</span>
      </SectionTitle>

      {/* ── Alertes annulé/reporté ── */}
      {nbUrgentes > 0 && (
        <div style={{
          background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
          borderRadius: 10, padding: "10px 16px", marginBottom: 16,
          display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: T.yellow,
        }}>
          ⚠️ <strong>{nbUrgentes}</strong> séance(s) annulée(s) ou reportée(s) dans la classe sélectionnée.
        </div>
      )}

      {/* ── Import Excel ── */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.sub,
          letterSpacing: "0.07em", marginBottom: 12 }}>
          📤 IMPORTER UN PLANNING (.xlsx) — PLUSIEURS SÉANCES EN UNE FOIS
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          {[
            { label: "Filière",  key: "filiere",  opts: FILIERES.map(f => ({ value: f.code, label: f.code })) },
            { label: "Niveau",   key: "niveau",   opts: NIVEAUX.map(n  => ({ value: n.code, label: n.code })) },
            { label: "Semestre", key: "semestre", opts: (SEMESTRES || ["S1","S2"]).map(s => ({ value: s, label: s })) },
          ].map(({ label, key, opts }) => (
            <div key={key} style={{ flex: 1, minWidth: 90 }}>
              <div style={{ fontSize: 10, color: T.sub, marginBottom: 5, fontWeight: 700, letterSpacing: "0.07em" }}>
                {label.toUpperCase()}
              </div>
              <select value={uploadFrm[key]}
                onChange={e => setUploadFrm(p => ({ ...p, [key]: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 7,
                  border: `1px solid ${T.border}`, background: T.sidebar,
                  color: T.text, fontSize: 12, fontFamily: "inherit" }}>
                {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          ))}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
            onChange={e => { if (e.target.files[0]) handleUpload(e.target.files[0]); }} />
          <Btn onClick={() => fileRef.current.click()}>📤 Choisir un fichier</Btn>
        </div>
      </Card>

      {/* ── Layout principal ── */}
      <div style={{ display: "grid", gridTemplateColumns: "190px 1fr", gap: 14 }}>

        {/* ── Liste des classes ── */}
        <div>
          <Card padding={0} style={{ maxHeight: 580, overflowY: "auto" }}>
            <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`,
              fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: "0.07em" }}>
              CLASSES ({classes.length})
            </div>
            {classes.length === 0 ? (
              <div style={{ padding: 20, color: T.muted, fontSize: 12, textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
                Aucun planning.<br/>
                <span style={{ fontSize: 11 }}>Ajoutez une séance<br/>ou importez un Excel.</span>
              </div>
            ) : classes.map(cl => (
              <div key={cl} onClick={() => loadSeances(cl)} style={{
                padding: "10px 14px", cursor: "pointer",
                borderBottom: `1px solid ${T.border}`,
                background: classe === cl ? "rgba(200,16,46,0.12)" : "transparent",
                fontSize: 12, color: classe === cl ? T.text : T.sub,
                fontWeight: classe === cl ? 700 : 400,
                borderLeft: classe === cl ? "3px solid #C8102E" : "3px solid transparent",
                transition: "all 0.12s",
              }}>
                {cl}
              </div>
            ))}
          </Card>

          {/* Bouton rapide sous la liste */}
          <button onClick={() => setAddModal(true)} style={{
            width: "100%", marginTop: 8, padding: "9px 0",
            borderRadius: 9, border: `1px dashed ${T.border}`,
            background: "transparent", color: T.sub, fontSize: 12,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            + Nouvelle séance
          </button>
        </div>

        {/* ── Séances de la classe ── */}
        <Card padding={0}>
          {!classe ? (
            <EmptyState icon="🗓️" message="Sélectionnez une classe à gauche" />
          ) : loading ? (
            <Spinner />
          ) : seances.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <div style={{ color: T.sub, fontSize: 14 }}>Aucune séance pour {classe}</div>
              <button onClick={() => { setAddFrm(f => ({ ...f, classe })); setAddModal(true); }}
                style={{ marginTop: 14, padding: "9px 20px", borderRadius: 9,
                  border: "none", background: T.accent, color: "#fff",
                  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                + Ajouter la première séance
              </button>
            </div>
          ) : (
            <>
              {/* Header classe */}
              <div style={{ padding: "12px 18px", borderBottom: `1px solid ${T.border}`,
                display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{classe}</span>
                  <span style={{ fontSize: 12, color: T.sub, marginLeft: 10 }}>
                    {seances.length} séance(s)
                  </span>
                </div>
                <button onClick={() => { setAddFrm(f => ({ ...f, classe })); setAddModal(true); }}
                  style={{ padding: "6px 14px", borderRadius: 8, border: "none",
                    background: T.accent, color: "#fff", fontSize: 12,
                    fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  + Séance
                </button>
              </div>

              {/* Séances groupées par date */}
              {Object.entries(seancesParDate)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, list]) => (
                  <div key={date}>
                    {/* Séparateur date */}
                    <div style={{ padding: "8px 18px", background: "rgba(255,255,255,0.02)",
                      borderBottom: `1px solid ${T.border}`, fontSize: 11,
                      fontWeight: 700, color: T.blue }}>
                      📅 {date !== "Sans date" && !isNaN(new Date(date))
                        ? new Date(date + "T00:00:00").toLocaleDateString("fr-FR", {
                            weekday: "long", day: "numeric", month: "long",
                          })
                        : date}
                    </div>

                    {list.map((s, i) => (
                      <div key={s.id} style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 120px 90px 100px 44px",
                        padding: "12px 18px", alignItems: "center", gap: 10,
                        borderBottom: i < list.length - 1 ? `1px solid ${T.border}` : "none",
                        background: s.statut === "annule" ? "rgba(239,68,68,0.04)"
                          : s.statut === "reporte" ? "rgba(245,158,11,0.04)" : "transparent",
                      }}>

                        {/* Module + UE + Prof */}
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                            {s.module}
                          </div>
                          <div style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>
                            {s.ue !== s.module && s.ue ? `${s.ue} · ` : ""}
                            {s.prof || "Professeur à définir"}
                            {s.heure ? ` · ${s.heure}` : ""}
                            {s.duree ? ` (${s.duree}h)` : ""}
                          </div>
                          {s.salle && (
                            <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>
                              🏛️ {s.salle} {s.site ? `· ${s.site}` : ""}
                            </div>
                          )}
                          {s.note && (
                            <div style={{ fontSize: 10, color: T.yellow, marginTop: 2 }}>
                              ℹ️ {s.note}
                            </div>
                          )}
                        </div>

                        {/* Heures */}
                        <div style={{ fontSize: 11, color: T.sub, textAlign: "center" }}>
                          {s.heures_faites > 0 || s.heures_prevues > 0 ? (
                            <>
                              <div style={{ fontWeight: 600, color: T.text }}>
                                {s.heures_faites || 0}/{s.heures_prevues || 0}h
                              </div>
                              <div style={{ height: 4, background: "rgba(255,255,255,0.07)",
                                borderRadius: 2, marginTop: 4 }}>
                                <div style={{
                                  height: 4, borderRadius: 2,
                                  background: T.green,
                                  width: `${Math.min(100, ((s.heures_faites || 0) / Math.max(s.heures_prevues || 1, 1)) * 100)}%`,
                                }} />
                              </div>
                            </>
                          ) : "—"}
                        </div>

                        {/* Semestre */}
                        <div style={{ fontSize: 11, color: T.muted, textAlign: "center" }}>
                          {s.semestre || "—"}
                        </div>

                        {/* Statut */}
                        <div>
                          <span style={{
                            fontSize: 11, fontWeight: 600,
                            color: STATUT_COLOR[s.statut] || T.sub,
                            background: (STATUT_COLOR[s.statut] || T.sub) + "15",
                            padding: "3px 8px", borderRadius: 6,
                          }}>
                            { { programme: "📅 Prog.", en_ligne: "💻 Ligne",
                                annule: "❌ Annulé", reporte: "⏸️ Reporté" }[s.statut] || s.statut }
                          </span>
                        </div>

                        {/* Bouton édition */}
                        <button onClick={() => {
                          setEditModal(s);
                          setEditFrm({
                            module: s.module || "",
                            prof:   s.prof   || "",
                            date:   s.date   || "",
                            heure:  s.heure  || "",
                            duree:  s.duree  || 3,
                            statut: s.statut || "programme",
                            note:   s.note   || "",
                          });
                        }} style={{
                          background: "none", border: `1px solid ${T.border}`,
                          color: T.sub, borderRadius: 7, padding: "5px 9px",
                          cursor: "pointer", fontSize: 13,
                        }}>✏️</button>
                      </div>
                    ))}
                  </div>
                ))}
            </>
          )}
        </Card>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MODAL — AJOUTER UNE SÉANCE MANUELLEMENT
      ════════════════════════════════════════════════════════════════════ */}
      <Modal open={addModal} onClose={() => setAddModal(false)}
        title="➕ Ajouter une séance au planning" width={560}>

        <div style={{ fontSize: 12, color: T.sub, marginBottom: 16, lineHeight: 1.5,
          background: "rgba(59,130,246,0.06)", padding: "10px 14px", borderRadius: 8,
          border: "1px solid rgba(59,130,246,0.15)" }}>
          ℹ️ La classe sera générée automatiquement : <strong style={{ color: T.cyan }}>NIVEAU-FILIÈRE</strong>
          {" "}(ex: M2-SRT). Vous pouvez aussi la saisir manuellement.
        </div>

        {/* Ligne 1 : filière + niveau + semestre */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 12px" }}>
          <div>
            <label style={{ fontSize: 10, color: T.sub, display: "block", marginBottom: 5,
              fontWeight: 700, letterSpacing: "0.07em" }}>FILIÈRE *</label>
            <select value={addFrm.filiere}
              onChange={e => setAddFrm(p => ({ ...p, filiere: e.target.value }))}
              style={{ width: "100%", padding: "9px 10px", borderRadius: 8,
                border: `1px solid ${T.border}`, background: T.sidebar,
                color: T.text, fontSize: 12, fontFamily: "inherit", marginBottom: 12 }}>
              {FILIERES.map(f => (
                <option key={f.code} value={f.code}>{f.code} — {f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, color: T.sub, display: "block", marginBottom: 5,
              fontWeight: 700, letterSpacing: "0.07em" }}>NIVEAU *</label>
            <select value={addFrm.niveau}
              onChange={e => setAddFrm(p => ({ ...p, niveau: e.target.value }))}
              style={{ width: "100%", padding: "9px 10px", borderRadius: 8,
                border: `1px solid ${T.border}`, background: T.sidebar,
                color: T.text, fontSize: 12, fontFamily: "inherit", marginBottom: 12 }}>
              {NIVEAUX.map(n => (
                <option key={n.code} value={n.code}>{n.code} — {n.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, color: T.sub, display: "block", marginBottom: 5,
              fontWeight: 700, letterSpacing: "0.07em" }}>SEMESTRE</label>
            <select value={addFrm.semestre}
              onChange={e => setAddFrm(p => ({ ...p, semestre: e.target.value }))}
              style={{ width: "100%", padding: "9px 10px", borderRadius: 8,
                border: `1px solid ${T.border}`, background: T.sidebar,
                color: T.text, fontSize: 12, fontFamily: "inherit", marginBottom: 12 }}>
              {["S1","S2"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Classe générée (aperçu + override) */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 10, color: T.sub, display: "block", marginBottom: 5,
            fontWeight: 700, letterSpacing: "0.07em" }}>
            CLASSE (auto-générée ou personnalisée)
          </label>
          <input
            value={addFrm.classe || `${addFrm.niveau}-${addFrm.filiere}`}
            onChange={e => setAddFrm(p => ({ ...p, classe: e.target.value }))}
            placeholder={`${addFrm.niveau}-${addFrm.filiere}`}
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8,
              border: `1px solid ${T.blue}40`, background: T.sidebar,
              color: T.cyan, fontSize: 13, fontWeight: 600,
              fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Module + UE */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
          <div>
            <label style={{ fontSize: 10, color: T.sub, display: "block", marginBottom: 5,
              fontWeight: 700, letterSpacing: "0.07em" }}>MODULE *</label>
            <input value={addFrm.module}
              onChange={e => setAddFrm(p => ({ ...p, module: e.target.value }))}
              placeholder="Ex: Développement Web"
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8,
                border: `1px solid ${T.border}`, background: T.sidebar,
                color: T.text, fontSize: 12, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: T.sub, display: "block", marginBottom: 5,
              fontWeight: 700, letterSpacing: "0.07em" }}>UE (Unité d'enseignement)</label>
            <input value={addFrm.ue}
              onChange={e => setAddFrm(p => ({ ...p, ue: e.target.value }))}
              placeholder="Ex: UE Informatique (optionnel)"
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8,
                border: `1px solid ${T.border}`, background: T.sidebar,
                color: T.text, fontSize: 12, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
          </div>
        </div>

        {/* Professeur */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 10, color: T.sub, display: "block", marginBottom: 5,
            fontWeight: 700, letterSpacing: "0.07em" }}>PROFESSEUR</label>
          <input value={addFrm.prof}
            onChange={e => setAddFrm(p => ({ ...p, prof: e.target.value }))}
            placeholder="Ex: Dr. Moussa Ndiaye"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8,
              border: `1px solid ${T.border}`, background: T.sidebar,
              color: T.text, fontSize: 12, fontFamily: "inherit",
              outline: "none", boxSizing: "border-box" }} />
        </div>

        {/* Date + Heure + Durée */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 12px" }}>
          <div>
            <label style={{ fontSize: 10, color: T.sub, display: "block", marginBottom: 5,
              fontWeight: 700, letterSpacing: "0.07em" }}>DATE</label>
            <input type="date" value={addFrm.date}
              onChange={e => setAddFrm(p => ({ ...p, date: e.target.value }))}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8,
                border: `1px solid ${T.border}`, background: T.sidebar,
                color: T.text, fontSize: 12, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: T.sub, display: "block", marginBottom: 5,
              fontWeight: 700, letterSpacing: "0.07em" }}>HEURE</label>
            <input type="time" value={addFrm.heure}
              onChange={e => setAddFrm(p => ({ ...p, heure: e.target.value }))}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8,
                border: `1px solid ${T.border}`, background: T.sidebar,
                color: T.text, fontSize: 12, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: T.sub, display: "block", marginBottom: 5,
              fontWeight: 700, letterSpacing: "0.07em" }}>DURÉE (h)</label>
            <input type="number" value={addFrm.duree} min="0.5" max="8" step="0.5"
              onChange={e => setAddFrm(p => ({ ...p, duree: e.target.value }))}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8,
                border: `1px solid ${T.border}`, background: T.sidebar,
                color: T.text, fontSize: 12, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
          </div>
        </div>

        {/* Heures prévues + Statut */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
          <div>
            <label style={{ fontSize: 10, color: T.sub, display: "block", marginBottom: 5,
              fontWeight: 700, letterSpacing: "0.07em" }}>HEURES PRÉVUES (total module)</label>
            <input type="number" value={addFrm.heures_prevues} min="1"
              onChange={e => setAddFrm(p => ({ ...p, heures_prevues: e.target.value }))}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8,
                border: `1px solid ${T.border}`, background: T.sidebar,
                color: T.text, fontSize: 12, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: T.sub, display: "block", marginBottom: 5,
              fontWeight: 700, letterSpacing: "0.07em" }}>STATUT</label>
            <select value={addFrm.statut}
              onChange={e => setAddFrm(p => ({ ...p, statut: e.target.value }))}
              style={{ width: "100%", padding: "9px 10px", borderRadius: 8,
                border: `1px solid ${T.border}`, background: T.sidebar,
                color: T.text, fontSize: 12, fontFamily: "inherit", marginBottom: 12 }}>
              {STATUT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Note / motif */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, color: T.sub, display: "block", marginBottom: 5,
            fontWeight: 700, letterSpacing: "0.07em" }}>NOTE / MOTIF (optionnel)</label>
          <textarea value={addFrm.note}
            onChange={e => setAddFrm(p => ({ ...p, note: e.target.value }))}
            placeholder="Ex: Salle de TP requise, apporter les laptops…"
            rows={2}
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8,
              border: `1px solid ${T.border}`, background: T.sidebar,
              color: T.text, fontSize: 12, fontFamily: "inherit",
              outline: "none", boxSizing: "border-box", resize: "none" }} />
        </div>

        {/* Boutons */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={() => setAddModal(false)} style={{
            padding: "9px 20px", borderRadius: 9, border: `1px solid ${T.border}`,
            background: "transparent", color: T.sub, fontSize: 13,
            cursor: "pointer", fontFamily: "inherit",
          }}>Annuler</button>
          <button onClick={addSeance} disabled={addLoading || !addFrm.module} style={{
            padding: "9px 24px", borderRadius: 9, border: "none",
            background: addLoading || !addFrm.module ? T.muted : T.accent,
            color: "#fff", fontSize: 13, fontWeight: 700,
            cursor: addLoading || !addFrm.module ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}>
            {addLoading ? "Enregistrement…" : "✅ Ajouter la séance"}
          </button>
        </div>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════
          MODAL — MODIFIER UNE SÉANCE
      ════════════════════════════════════════════════════════════════════ */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="✏️ Modifier la séance">
        <Input label="Module" value={editFrm.module || ""}
          onChange={v => setEditFrm(p => ({ ...p, module: v }))} />
        <Input label="Professeur" value={editFrm.prof || ""}
          onChange={v => setEditFrm(p => ({ ...p, prof: v }))} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
          <Input label="Date (YYYY-MM-DD)" value={editFrm.date || ""}
            onChange={v => setEditFrm(p => ({ ...p, date: v }))} />
          <Input label="Heure (HH:MM)" value={editFrm.heure || ""}
            onChange={v => setEditFrm(p => ({ ...p, heure: v }))} />
        </div>
        <Input label="Statut" value={editFrm.statut || "programme"}
          onChange={v => setEditFrm(p => ({ ...p, statut: v }))}
          options={STATUT_OPTS} />
        <Input label="Note / Motif" value={editFrm.note || ""}
          onChange={v => setEditFrm(p => ({ ...p, note: v }))}
          placeholder="Ex: Cours annulé — professeur absent" rows={2} />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setEditModal(null)}>Annuler</Btn>
          <Btn onClick={saveSeance}>Enregistrer</Btn>
        </div>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════
          MODAL — GESTION DES SALLES  (FIX : reload immédiat après création)
      ════════════════════════════════════════════════════════════════════ */}
      <Modal open={salleModal} onClose={() => setSalleModal(false)}
        title="🏛️ Gestion des salles" width={500}>

        {/* Liste des salles existantes */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.sub,
            letterSpacing: "0.07em", marginBottom: 10 }}>
            SALLES CONFIGURÉES ({salles.length})
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {salles.length === 0 ? (
              <div style={{ color: T.muted, fontSize: 12, textAlign: "center", padding: 16 }}>
                Aucune salle configurée
              </div>
            ) : salles.map(s => (
              <div key={s.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "9px 12px", borderRadius: 8,
                background: T.sidebar, marginBottom: 6,
                border: `1px solid ${T.border}`,
              }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{s.nom}</span>
                  <span style={{ fontSize: 11, color: T.sub, marginLeft: 8 }}>
                    {s.site} · {s.capacite} places
                  </span>
                </div>
                <button onClick={() => supprimerSalle(s.id)} style={{
                  background: "none", border: "1px solid rgba(239,68,68,0.2)",
                  color: "#F87171", borderRadius: 6, padding: "4px 8px",
                  cursor: "pointer", fontSize: 13,
                }}>🗑️</button>
              </div>
            ))}
          </div>
        </div>

        <Divider />

        {/* Formulaire nouvelle salle */}
        <div style={{ fontSize: 10, fontWeight: 700, color: T.sub,
          letterSpacing: "0.07em", marginBottom: 12, marginTop: 12 }}>
          CRÉER UNE NOUVELLE SALLE
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
          <div>
            <label style={{ fontSize: 10, color: T.sub, display: "block", marginBottom: 5,
              fontWeight: 700, letterSpacing: "0.07em" }}>SITE</label>
            <select value={salleFrm.site}
              onChange={e => setSalleFrm(p => ({ ...p, site: e.target.value }))}
              style={{ width: "100%", padding: "9px 10px", borderRadius: 8,
                border: `1px solid ${T.border}`, background: T.card,
                color: T.text, fontSize: 12, fontFamily: "inherit", marginBottom: 12 }}>
              {(SITES || ["AFI_SIEGE","AFITECH","AFIPOINT_E","LYCEE"]).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, color: T.sub, display: "block", marginBottom: 5,
              fontWeight: 700, letterSpacing: "0.07em" }}>CAPACITÉ</label>
            <input type="number" value={salleFrm.capacite} min="1"
              onChange={e => setSalleFrm(p => ({ ...p, capacite: e.target.value }))}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8,
                border: `1px solid ${T.border}`, background: T.card,
                color: T.text, fontSize: 12, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 10, color: T.sub, display: "block", marginBottom: 5,
            fontWeight: 700, letterSpacing: "0.07em" }}>NOM DE LA SALLE *</label>
          <input value={salleFrm.nom}
            onChange={e => setSalleFrm(p => ({ ...p, nom: e.target.value }))}
            placeholder="Ex: Salle 12, Amphi A…"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8,
              border: `1px solid ${T.border}`, background: T.card,
              color: T.text, fontSize: 12, fontFamily: "inherit",
              outline: "none", boxSizing: "border-box" }} />
        </div>

        <button onClick={ajouterSalle} disabled={!salleFrm.nom.trim()} style={{
          width: "100%", padding: "11px 0", borderRadius: 9, border: "none",
          background: !salleFrm.nom.trim() ? T.muted : T.blue,
          color: "#fff", fontSize: 13, fontWeight: 700,
          cursor: !salleFrm.nom.trim() ? "not-allowed" : "pointer",
          fontFamily: "inherit",
        }}>
          🏛️ Créer la salle
        </button>
      </Modal>
    </div>
  );
}
