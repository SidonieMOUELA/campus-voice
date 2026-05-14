// ─── pages/Signalements.jsx ───────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { T, CAT_COLOR, CAT_ICON, STATUT_META, URGENCE_COLOR } from "../theme.js";
import { getSignalements, updateStatut, deleteSignalement } from "../api.js";

// ─── Helpers visuels locaux ───────────────────────────────────────────────────
function Badge({ children, color, bg }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 20,
      background: bg || "rgba(255,255,255,0.07)",
      color: color || "#9CA3AF", fontSize: 11, fontWeight: 600,
      flexShrink: 0,
    }}>{children}</span>
  );
}

function CatTag({ cat }) {
  const color = CAT_COLOR[cat] || "#9CA3AF";
  const icon  = CAT_ICON[cat]  || "📌";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 8,
      background: `${color}18`, color, fontSize: 11, fontWeight: 700,
    }}>{icon} {cat}</span>
  );
}

function StatutTag({ statut }) {
  const s = STATUT_META[statut] || { bg: "rgba(255,255,255,0.07)", text: "#9CA3AF", dot: "#9CA3AF", label: statut };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 11px", borderRadius: 20,
      background: s.bg, color: s.text, fontSize: 11, fontWeight: 600,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot }} />
      {s.label}
    </span>
  );
}

function UrgTag({ n }) {
  const level = Math.min(n || 0, 5);
  const color = URGENCE_COLOR[level];
  const label = ["—", "Faible", "Modérée", "Élevée", "Critique", "Extrême"][level] || "—";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 8,
      background: `${color}14`, color, fontSize: 11, fontWeight: 700,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />
      {label} ({level}/5)
    </span>
  );
}

// ─── Barre de score IA ────────────────────────────────────────────────────────
function ScoreBar({ score }) {
  const max   = 100;
  const pct   = Math.min((score / max) * 100, 100);
  const color = score > 20 ? T.red : score > 10 ? T.orange : score > 5 ? T.yellow : T.green;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 4 }}>
        <div style={{ height: 4, width: `${pct}%`, borderRadius: 4, background: color,
          transition: "width 0.5s ease" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 32, textAlign: "right" }}>
        {score?.toFixed(1) || "0"}
      </span>
    </div>
  );
}

// ─── Chip filtre rapide ───────────────────────────────────────────────────────
function FilterChip({ label, count, active, color, bg, dot, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "6px 14px", borderRadius: 22,
      border: `1px solid ${active ? (dot || color || T.border) : T.border}`,
      background: active ? (bg || "rgba(255,255,255,0.06)") : "transparent",
      color: active ? (color || T.text) : T.sub,
      fontSize: 12, fontWeight: active ? 700 : 400,
      cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot }} />}
      {label}
      <span style={{
        padding: "1px 7px", borderRadius: 10, fontSize: 10, fontWeight: 700,
        background: active ? (dot || color ? `${dot || color}22` : "rgba(255,255,255,0.1)") : "rgba(255,255,255,0.06)",
        color: active ? (dot || color || T.text) : T.muted,
      }}>{count}</span>
    </button>
  );
}

// ─── Panneau détail latéral ───────────────────────────────────────────────────
function DetailPanel({ s, onClose, onStatut, onDelete }) {
  const sm = STATUT_META[s.statut] || {};
  const urgColor = URGENCE_COLOR[Math.min(s.niveau_urgence || 0, 5)];

  return (
    <div style={{
      background: T.card, borderRadius: 18,
      border: `1px solid ${T.border}`,
      display: "flex", flexDirection: "column",
      maxHeight: "calc(100vh - 140px)", position: "sticky", top: 0,
      overflow: "hidden",
    }}>
      {/* Header coloré */}
      <div style={{
        padding: "18px 20px 16px",
        borderBottom: `1px solid ${T.border}`,
        background: `linear-gradient(135deg, ${urgColor}10, transparent)`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <CatTag cat={s.categorie} />
            <UrgTag n={s.niveau_urgence} />
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.06)", border: `1px solid ${T.border}`,
            color: T.sub, cursor: "pointer", fontSize: 14, borderRadius: 8,
            padding: "4px 8px", flexShrink: 0,
          }}>✕</button>
        </div>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: T.text,
          margin: "0 0 8px", lineHeight: 1.4 }}>{s.titre}</h2>
        <StatutTag statut={s.statut} />
      </div>

      {/* Corps scrollable */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

        {/* Description */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.muted,
            letterSpacing: "0.08em", marginBottom: 8 }}>DESCRIPTION</div>
          <p style={{ fontSize: 13, color: T.sub, lineHeight: 1.7, margin: 0 }}>
            {s.description}
          </p>
        </div>

        {/* Méta-infos */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
          marginBottom: 20,
        }}>
          {[
            { icon: "👤", label: "Auteur",    val: s.anonyme ? "Anonyme" : (s.auteur || "—") },
            { icon: "📅", label: "Date",      val: new Date(s.created_at).toLocaleDateString("fr-FR", { day:"2-digit", month:"short", year:"numeric" }) },
            { icon: "📍", label: "Localisation", val: s.localisation || "Non précisée" },
            { icon: "❤️", label: "Likes",     val: `${s.likes || 0} soutien(s)` },
          ].map(({ icon, label, val }) => (
            <div key={label} style={{
              padding: "10px 12px", borderRadius: 10,
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${T.border}`,
            }}>
              <div style={{ fontSize: 10, color: T.muted, marginBottom: 4, fontWeight: 600 }}>
                {icon} {label.toUpperCase()}
              </div>
              <div style={{ fontSize: 12, color: T.text, fontWeight: 500 }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Score IA */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.muted,
            letterSpacing: "0.08em", marginBottom: 8 }}>SCORE IA (PRIORITÉ)</div>
          <ScoreBar score={s.score_ia} />
        </div>

        {/* Analyse IA */}
        {(s.decision_strategique || s.action_concrete) && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.purple,
              letterSpacing: "0.08em", marginBottom: 10 }}>🤖 RECOMMANDATIONS IA</div>

            {s.decision_strategique && (
              <div style={{
                padding: "12px 14px", borderRadius: 10, marginBottom: 10,
                background: "rgba(59,130,246,0.08)",
                borderLeft: `3px solid ${T.blue}`,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.blue,
                  letterSpacing: "0.06em", marginBottom: 6 }}>📊 DÉCISION STRATÉGIQUE</div>
                <p style={{ fontSize: 12, color: "#93C5FD", lineHeight: 1.6, margin: 0 }}>
                  {s.decision_strategique}
                </p>
              </div>
            )}

            {s.action_concrete && (
              <div style={{
                padding: "12px 14px", borderRadius: 10,
                background: "rgba(16,185,129,0.08)",
                borderLeft: `3px solid ${T.green}`,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.green,
                  letterSpacing: "0.06em", marginBottom: 6 }}>⚡ ACTION CONCRÈTE</div>
                <p style={{ fontSize: 12, color: "#6EE7B7", lineHeight: 1.6, margin: 0 }}>
                  {s.action_concrete}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div style={{
        padding: "14px 20px", borderTop: `1px solid ${T.border}`,
        background: "rgba(0,0,0,0.2)",
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.muted,
          letterSpacing: "0.08em" }}>CHANGER LE STATUT</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {Object.entries(STATUT_META).map(([k, v]) => (
            <button key={k} onClick={() => onStatut(s.id, k)}
              style={{
                padding: "8px 10px", borderRadius: 9, cursor: "pointer",
                border: `1px solid ${s.statut === k ? v.dot : T.border}`,
                background: s.statut === k ? v.bg : "transparent",
                color: s.statut === k ? v.text : T.sub,
                fontSize: 11, fontWeight: s.statut === k ? 700 : 400,
                fontFamily: "inherit", transition: "all 0.14s",
                display: "flex", alignItems: "center", gap: 6,
              }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%",
                background: s.statut === k ? v.dot : T.muted }} />
              {v.label}
            </button>
          ))}
        </div>
        <button onClick={() => onDelete(s.id)} style={{
          width: "100%", padding: "9px", borderRadius: 9, cursor: "pointer",
          border: "1px solid rgba(239,68,68,0.2)",
          background: "rgba(239,68,68,0.06)", color: "#F87171",
          fontSize: 12, fontWeight: 600, fontFamily: "inherit",
          transition: "all 0.14s",
        }}>🗑️ Supprimer ce signalement</button>
      </div>
    </div>
  );
}

// ─── Carte signalement ────────────────────────────────────────────────────────
function SigCard({ s, isSelected, onClick, onStatut }) {
  const urgColor = URGENCE_COLOR[Math.min(s.niveau_urgence || 0, 5)];
  const sm = STATUT_META[s.statut] || {};
  const isUrgent = (s.niveau_urgence || 0) >= 3;

  return (
    <div onClick={onClick} style={{
      padding: "16px 20px",
      borderBottom: `1px solid ${T.border}`,
      cursor: "pointer", transition: "all 0.15s",
      background: isSelected
        ? "rgba(59,130,246,0.06)"
        : isUrgent ? "rgba(239,68,68,0.02)" : "transparent",
      borderLeft: `3px solid ${isSelected ? T.blue : isUrgent ? urgColor : "transparent"}`,
      position: "relative",
    }}>
      {/* Ligne 1 : Titre + Statut + Select */}
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 0 }}>
          {/* Icône catégorie */}
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: `${CAT_COLOR[s.categorie] || "#9CA3AF"}18`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 17, marginTop: 1,
          }}>
            {CAT_ICON[s.categorie] || "📌"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.text,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.titre}
              </span>
              {s.anonyme && (
                <span style={{ fontSize: 9, color: T.muted, background: "rgba(255,255,255,0.04)",
                  padding: "2px 7px", borderRadius: 10, flexShrink: 0 }}>ANONYME</span>
              )}
            </div>
            <p style={{ fontSize: 12, color: T.sub, margin: 0,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.description}
            </p>
          </div>
        </div>

        {/* Select statut inline */}
        <div onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
          <select value={s.statut} onChange={e => onStatut(s.id, e.target.value)}
            style={{
              padding: "6px 10px", borderRadius: 8,
              border: `1px solid ${sm.dot || T.border}`,
              background: sm.bg || T.sidebar,
              color: sm.text || T.text,
              fontSize: 11, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
            }}>
            {Object.entries(STATUT_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Ligne 2 : Badges + Score + Date */}
      <div style={{ display: "flex", alignItems: "center", gap: 8,
        flexWrap: "wrap", paddingLeft: 46 }}>
        <CatTag cat={s.categorie} />
        <StatutTag statut={s.statut} />
        <UrgTag n={s.niveau_urgence} />

        {/* Séparateur */}
        <div style={{ flex: 1 }} />

        {/* Score IA compact */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 10, color: T.muted }}>Score IA</span>
          <span style={{ fontSize: 12, fontWeight: 700,
            color: s.score_ia > 20 ? T.red : s.score_ia > 5 ? T.yellow : T.sub }}>
            {s.score_ia?.toFixed(1) || "0"}
          </span>
        </div>

        <div style={{ width: 1, height: 14, background: T.border }} />

        {/* Auteur + date */}
        <span style={{ fontSize: 11, color: T.muted }}>
          {s.auteur || "Anonyme"} · {new Date(s.created_at).toLocaleDateString("fr-FR")}
        </span>

        {/* Flèche si sélectionné */}
        {isSelected && (
          <span style={{ fontSize: 12, color: T.blue }}>→</span>
        )}
      </div>
    </div>
  );
}

// ─── PAGE SIGNALEMENTS ────────────────────────────────────────────────────────
export default function Signalements({ token, showToast }) {
  const [sigs,     setSigs]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [statutF,  setStatutF]  = useState("");
  const [catF,     setCatF]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSignalements(token, {
        statut:    statutF || undefined,
        categorie: catF    || undefined,
      });
      setSigs(Array.isArray(data) ? data : []);
    } catch (e) {
      showToast?.("❌ " + e.message, "error");
      setSigs([]);
    } finally {
      setLoading(false);
    }
  }, [token, statutF, catF]);

  useEffect(() => { load(); }, [load]);

  const handleStatut = async (id, statut) => {
    try {
      await updateStatut(token, id, statut);
      setSigs(prev => prev.map(s => s.id === id ? { ...s, statut } : s));
      setSelected(prev => prev?.id === id ? { ...prev, statut } : prev);
      showToast?.("✅ Statut mis à jour", "success");
    } catch (e) {
      showToast?.("❌ " + e.message, "error");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer définitivement ce signalement ?")) return;
    try {
      await deleteSignalement(token, id);
      setSigs(prev => prev.filter(s => s.id !== id));
      setSelected(null);
      showToast?.("🗑️ Signalement supprimé", "success");
    } catch (e) {
      showToast?.("❌ " + e.message, "error");
    }
  };

  // Compteurs par statut
  const counts = sigs.reduce((acc, s) => {
    acc[s.statut] = (acc[s.statut] || 0) + 1;
    return acc;
  }, {});
  const totalUrgents = sigs.filter(s => (s.niveau_urgence || 0) >= 3 && s.statut !== "resolu").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, minHeight: 0 }}>

      {/* ── EN-TÊTE ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "flex-end", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: T.text,
              margin: "0 0 4px", letterSpacing: -0.5 }}>Signalements</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, color: T.sub }}>
                {sigs.length} signalement(s) au total
              </span>
              {totalUrgents > 0 && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "3px 10px", borderRadius: 20,
                  background: "rgba(239,68,68,0.12)",
                  color: "#F87171", fontSize: 11, fontWeight: 700,
                }}>
                  🚨 {totalUrgents} urgence(s) active(s)
                </span>
              )}
            </div>
          </div>

          {/* Filtres droite */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select value={catF} onChange={e => { setCatF(e.target.value); setSelected(null); }}
              style={{ padding: "8px 14px", borderRadius: 9, border: `1px solid ${T.border}`,
                background: T.card, color: catF ? T.text : T.sub,
                fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}>
              <option value="">Toutes catégories</option>
              {Object.keys(CAT_COLOR).map(c => (
                <option key={c} value={c}>{CAT_ICON[c]} {c}</option>
              ))}
            </select>

            <button onClick={load} style={{
              padding: "8px 14px", borderRadius: 9,
              border: `1px solid ${T.border}`, background: "transparent",
              color: T.sub, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `${T.blue}50`; e.currentTarget.style.color = T.text; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.sub; }}>
              🔄 Actualiser
            </button>
          </div>
        </div>

        {/* ── Filtres rapides statut ── */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <FilterChip
            label="Tous" count={sigs.length}
            active={statutF === ""}
            color={T.text} bg="rgba(255,255,255,0.06)"
            onClick={() => { setStatutF(""); setSelected(null); }}
          />
          {Object.entries(STATUT_META).map(([k, v]) => (
            <FilterChip key={k}
              label={v.label} count={counts[k] || 0}
              active={statutF === k}
              color={v.text} bg={v.bg} dot={v.dot}
              onClick={() => { setStatutF(statutF === k ? "" : k); setSelected(null); }}
            />
          ))}
        </div>
      </div>

      {/* ── CONTENU ── */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: 64, gap: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%",
            border: `2px solid ${T.border}`, borderTop: `2px solid ${T.accent}`,
            animation: "cv-spin 0.7s linear infinite" }} />
          <span style={{ fontSize: 13, color: T.sub }}>Chargement des signalements…</span>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: selected ? "1fr 420px" : "1fr",
          gap: 16, alignItems: "start",
        }}>
          {/* Liste */}
          <div style={{
            background: T.card, borderRadius: 18,
            border: `1px solid ${T.border}`, overflow: "hidden",
          }}>
            {/* En-tête liste */}
            <div style={{
              padding: "14px 20px", borderBottom: `1px solid ${T.border}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "rgba(0,0,0,0.15)",
            }}>
              <div style={{ display: "flex", gap: 16 }}>
                {[
                  { label: "# SIGNALEMENT", w: "1fr" },
                  { label: "CATÉGORIE / STATUT / URGENCE", w: "auto" },
                  { label: "SCORE IA", w: "80px" },
                  { label: "DATE", w: "80px" },
                ].map(h => (
                  <span key={h.label} style={{ fontSize: 10, fontWeight: 700,
                    color: T.muted, letterSpacing: "0.07em" }}>{h.label}</span>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5,
                fontSize: 11, color: T.green }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%",
                  background: T.green }} />
                Live
              </div>
            </div>

            {sigs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "56px 20px" }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>📭</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                  Aucun signalement
                </div>
                <div style={{ fontSize: 12, color: T.muted }}>
                  {statutF || catF
                    ? "Aucun résultat pour ces filtres — essayez d'autres critères."
                    : "Aucun signalement n'a encore été soumis par les étudiants."}
                </div>
              </div>
            ) : (
              sigs.map(s => (
                <SigCard
                  key={s.id}
                  s={s}
                  isSelected={selected?.id === s.id}
                  onClick={() => setSelected(prev => prev?.id === s.id ? null : s)}
                  onStatut={handleStatut}
                />
              ))
            )}
          </div>

          {/* Détail */}
          {selected && (
            <DetailPanel
              s={selected}
              onClose={() => setSelected(null)}
              onStatut={handleStatut}
              onDelete={handleDelete}
            />
          )}
        </div>
      )}
    </div>
  );
}
