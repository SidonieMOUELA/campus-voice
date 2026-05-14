// ─── pages/Dashboard.jsx ──────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { T, CAT_COLOR, CAT_ICON, STATUT_META, URGENCE_COLOR } from "../theme.js";
import {
  Card, KpiCard, CatBadge, StatutBadge, UrgenceBadge,
  Spinner, EmptyState, AlertBanner, ProgressBar,
  Btn, SectionTitle,
} from "../components/ui.jsx";
import {
  getKpis, getTop5, getUrgencesIA, getStatistiques,
  getAlertes, updateStatut,
} from "../api.js";

// ─── Sous-composant : Graphique en barres catégories ──────────────────────────
function CatBarChart({ data }) {
  if (!data.length) return <EmptyState icon="📊" message="Aucune donnée disponible" />;

  const sorted = [...data].sort((a, b) => b.total - a.total);
  const max = sorted[0]?.total || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {sorted.map(({ categorie, total }) => {
        const color = CAT_COLOR[categorie] || T.sub;
        const pct   = Math.round((total / max) * 100);
        return (
          <div key={categorie}>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: T.text, display: "flex",
                alignItems: "center", gap: 6 }}>
                <span>{CAT_ICON[categorie] || "📌"}</span>
                <span>{categorie}</span>
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color }}>{total}</span>
            </div>
            <ProgressBar value={total} max={max} color={color} />
          </div>
        );
      })}
    </div>
  );
}

// ─── Sous-composant : Jauge statuts ───────────────────────────────────────────
function StatutJauge({ statuts = [], total = 0 }) {
  const list = [
    { key: "en_attente",     color: T.accent },
    { key: "en_cours",       color: T.cyan   },
    { key: "pris_en_charge", color: T.purple },
    { key: "resolu",         color: T.green  },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {list.map(({ key, color }) => {
        const found = statuts.find(s => s.statut === key);
        const count = found?.total || 0;
        const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
        const meta  = STATUT_META[key];
        return (
          <div key={key}>
            <div style={{ display: "flex", justifyContent: "space-between",
              marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: T.sub }}>{meta?.label || key}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color }}>
                {count}{" "}
                <span style={{ color: T.muted, fontWeight: 400 }}>({pct}%)</span>
              </span>
            </div>
            <ProgressBar value={count} max={Math.max(total, 1)} color={color} />
          </div>
        );
      })}
    </div>
  );
}

// ─── Sous-composant : Urgences IA ────────────────────────────────────────────
function UrgencesPanel({ urgences = [], total = 0, onChangerStatut }) {
  if (!urgences.length) {
    return <EmptyState icon="🟢" message="Aucune urgence active" />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>
        {total} signalement(s) urgents non résolus
      </div>
      {urgences.slice(0, 5).map(u => (
        <div key={u.id} style={{
          padding: "10px 13px", borderRadius: 10,
          background: "rgba(239,68,68,0.06)",
          border: `1px solid ${URGENCE_COLOR[Math.min(u.niveau_urgence, 5)]}30`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.text, flex: 1 }}>
              {u.titre}
            </span>
            <UrgenceBadge n={u.niveau_urgence} />
          </div>
          <div style={{ fontSize: 11, color: T.sub, marginBottom: 6 }}>
            {u.decision || u.action || ""}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <CatBadge cat={u.categorie} />
            {onChangerStatut && (
              <select value={u.statut}
                onChange={e => onChangerStatut(u.id, e.target.value)}
                style={{
                  padding: "3px 7px", borderRadius: 6,
                  border: `1px solid ${T.border}`, background: T.sidebar,
                  color: T.text, fontSize: 10, fontFamily: "inherit",
                }}>
                {Object.entries(STATUT_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Sous-composant : Top 5 table ─────────────────────────────────────────────
function Top5Table({ items = [], onChangerStatut }) {
  if (!items.length) {
    return <EmptyState icon="📋" message="Aucun signalement" />;
  }

  return (
    <div>
      {/* En-tête */}
      <div style={{
        display: "grid", gridTemplateColumns: "36px 1fr 110px 130px 130px",
        padding: "8px 18px", fontSize: 10, fontWeight: 700,
        color: T.muted, letterSpacing: "0.07em",
        borderBottom: `1px solid ${T.border}`,
      }}>
        <span>#</span><span>SIGNALEMENT</span>
        <span>CATÉGORIE</span><span>STATUT</span><span>ACTION</span>
      </div>

      {items.map((s, i) => (
        <div key={s.id} style={{
          display: "grid", gridTemplateColumns: "36px 1fr 110px 130px 130px",
          padding: "12px 18px", alignItems: "center",
          borderBottom: i < items.length - 1 ? `1px solid ${T.border}` : "none",
          background: i === 0 ? "rgba(200,16,46,0.03)" : "transparent",
          gap: 8,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.blue }}>
            #{i + 1}
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: T.text, marginBottom: 2 }}>
              {s.titre}
            </div>
            {s.score_ia != null && (
              <div style={{ fontSize: 11, color: T.yellow }}>
                Score IA : {s.score_ia?.toFixed(1)}
              </div>
            )}
          </div>
          <CatBadge cat={s.categorie} />
          <StatutBadge statut={s.statut} />
          {onChangerStatut ? (
            <select value={s.statut}
              onChange={e => onChangerStatut(s.id, e.target.value)}
              style={{
                padding: "5px 8px", borderRadius: 7, border: `1px solid ${T.border}`,
                background: T.sidebar, color: STATUT_META[s.statut]?.text || T.text,
                fontSize: 11, fontFamily: "inherit",
              }}>
              {Object.entries(STATUT_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: 11, color: T.muted }}>—</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── PAGE DASHBOARD ───────────────────────────────────────────────────────────
export default function Dashboard({ token, showToast }) {
  const [kpis,     setKpis]     = useState(null);
  const [top5,     setTop5]     = useState([]);
  const [urgences, setUrgences] = useState({ total: 0, signalements: [] });
  const [stats,    setStats]    = useState(null);
  const [alertes,  setAlertes]  = useState({ alertes: [], total_alertes: 0 });
  const [loading,  setLoading]  = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [k, t, u, s, a] = await Promise.allSettled([
        getKpis(token),
        getTop5(token),
        getUrgencesIA(token),
        getStatistiques(token),
        getAlertes(token),
      ]);
      if (k.status === "fulfilled") setKpis(k.value);
      if (t.status === "fulfilled") setTop5(t.value);
      if (u.status === "fulfilled") setUrgences(u.value);
      if (s.status === "fulfilled") setStats(s.value);
      if (a.status === "fulfilled") setAlertes(a.value);
      setLastRefresh(new Date());
    } catch (e) {
      showToast?.("Erreur chargement : " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleChangerStatut = async (id, statut) => {
    try {
      await updateStatut(token, id, statut);
      setTop5(prev => prev.map(s => s.id === id ? { ...s, statut } : s));
      setUrgences(prev => ({
        ...prev,
        signalements: prev.signalements.map(s => s.id === id ? { ...s, statut } : s),
      }));
      showToast?.("✅ Statut mis à jour", "success");
    } catch (e) {
      showToast?.("❌ " + e.message, "error");
    }
  };

  if (loading) return <Spinner message="Chargement du tableau de bord…" />;

  // Calculs dérivés
  const total   = kpis?.total_signalements ?? 0;
  const catData = stats?.par_categorie || [];
  const alertesMessages = [
    ...alertes.alertes.map(a => a.message),
    ...urgences.signalements.slice(0, 2).map(u =>
      `⚠️ Urgence ${u.niveau_urgence}/5 — ${u.titre}`
    ),
  ];

  return (
    <div>
      {/* ── En-tête ── */}
      <SectionTitle action={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastRefresh && (
            <span style={{ fontSize: 11, color: T.muted }}>
              Mis à jour {lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Btn variant="ghost" small onClick={load}>🔄 Actualiser</Btn>
        </div>
      }>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: T.text, margin: 0 }}>
          Tableau de bord
        </h2>
        <span style={{ fontSize: 13, color: T.sub }}>
          {new Date().toLocaleDateString("fr-FR", {
            weekday: "long", day: "numeric", month: "long", year: "numeric",
          })}
        </span>
      </SectionTitle>

      {/* ── Alertes ── */}
      <AlertBanner items={alertesMessages} />

      {/* ── KPIs ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        gap: 14, marginBottom: 20,
      }}>
        <KpiCard label="Total signalements" value={kpis?.total_signalements ?? 0}
          color={T.blue} icon="📋"
          sub={`${kpis?.en_cours ?? 0} en cours de traitement`} />
        <KpiCard label="Taux de résolution" value={`${kpis?.taux_resolution ?? 0}%`}
          color={T.green} icon="✅"
          sub={`Objectif : 80%`} />
        <KpiCard label="Urgences actives" value={kpis?.signalements_urgents ?? 0}
          color={kpis?.signalements_urgents > 0 ? T.red : T.green} icon="🚨"
          sub="Niveau ≥ 3 non résolus" />
        <KpiCard label="Satisfaction moy." value={kpis?.satisfaction_moyenne ? `${kpis.satisfaction_moyenne}/5` : "—"}
          color={T.yellow} icon="⭐"
          sub="Post-résolution" />
      </div>

      {/* ── Ligne 2 : Catégories + Urgences ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14, marginBottom: 20 }}>
        <Card>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.sub,
            letterSpacing: "0.07em", marginBottom: 16 }}>
            RÉPARTITION PAR CATÉGORIE
          </div>
          <CatBarChart data={catData} />
        </Card>

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, letterSpacing: "0.07em" }}>
              🤖 URGENCES IA
            </div>
            {urgences.total > 0 && (
              <span style={{ fontSize: 11, color: T.red, fontWeight: 700 }}>
                {urgences.total} active(s)
              </span>
            )}
          </div>
          <UrgencesPanel
            urgences={urgences.signalements}
            total={urgences.total}
            onChangerStatut={handleChangerStatut}
          />
        </Card>
      </div>

      {/* ── Ligne 3 : Top 5 + Statuts ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14, marginBottom: 20 }}>
        <Card padding={0}>
          <div style={{
            padding: "14px 18px", borderBottom: `1px solid ${T.border}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.sub, letterSpacing: "0.07em" }}>
              🏆 TOP 5 PRIORITÉS
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5,
              fontSize: 11, color: T.green }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.green }} />
              Live
            </span>
          </div>
          <Top5Table items={top5} onChangerStatut={handleChangerStatut} />
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Répartition statuts */}
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.sub,
              letterSpacing: "0.07em", marginBottom: 16 }}>
              RÉPARTITION DES STATUTS
            </div>
            <StatutJauge statuts={stats?.par_statut || []} total={total} />
          </Card>

          {/* Catégorie critique */}
          {kpis?.categorie_top && (
            <Card style={{ background: "rgba(200,16,46,0.05)",
              border: `1px solid ${T.borderAccent}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.sub,
                letterSpacing: "0.07em", marginBottom: 10 }}>
                📍 CATÉGORIE PRINCIPALE
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 28 }}>
                  {CAT_ICON[kpis.categorie_top] || "📌"}
                </span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>
                    {kpis.categorie_top}
                  </div>
                  <div style={{ fontSize: 11, color: T.sub }}>
                    Catégorie la plus signalée
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
