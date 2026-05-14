
// ─── App.jsx — Campus Voice Dashboard v4.1 ───────────────────────────────────
import { useState, useEffect, useCallback, useRef } from "react";
import { T }            from "./theme.js";
import { GlobalStyles, Toast } from "./components/ui.jsx";
import Sidebar          from "./components/Sidebar.jsx";
import Dashboard        from "./pages/Dashboard.jsx";
import Signalements     from "./pages/Signalements.jsx";
import { PageNotes, PagePlanning, PageInfos, PageUtilisateurs } from "./pages/OtherPages.jsx";
import { login, getMe } from "./api.js";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ─── Récupère les notifs non lues (sans crasher si erreur) ───────────────────
async function fetchNotifCount(token) {
  try {
    const r = await fetch(`${BASE}/notifications?non_lues_seulement=true&limite=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return 0;
    const data = await r.json();
    return Array.isArray(data) ? data.filter(n => !n.lue).length : 0;
  } catch {
    return 0;
  }
}

// ─── Page de connexion ────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [matricule, setMatricule] = useState("");
  const [password,  setPassword]  = useState("");
  const [erreur,    setErreur]    = useState("");
  const [loading,   setLoading]   = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!matricule.trim()) { setErreur("Saisissez votre matricule"); return; }
    setLoading(true); setErreur("");
    try {
      const res = await login(matricule.trim(), password);
      localStorage.setItem("cv_token", res.access_token);
      onLogin(res.access_token);
    } catch (err) {
      setErreur(err.message || "Identifiants incorrects");
    } finally {
      setLoading(false);
    }
  };

  const inp = {
    width: "100%", padding: "11px 14px", borderRadius: 9,
    border: `1px solid ${T.border}`, background: T.sidebar,
    color: T.text, fontSize: 13, outline: "none",
    boxSizing: "border-box", fontFamily: "inherit", transition: "border-color 0.2s",
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, position: "relative", overflow: "hidden" }}>
      {/* Glows */}
      <div style={{ position: "absolute", top: "-18%", left: "-8%", width: 520, height: 520,
        borderRadius: "50%", background: "rgba(200,16,46,0.05)", filter: "blur(90px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-18%", right: "-8%", width: 400, height: 400,
        borderRadius: "50%", background: "rgba(59,130,246,0.04)", filter: "blur(70px)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 400, position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 58, height: 58, borderRadius: 17, margin: "0 auto 16px",
            background: "linear-gradient(135deg,#C8102E,#8B0000)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 20, color: "#fff",
            boxShadow: "0 10px 32px rgba(200,16,46,0.4)",
          }}>CV</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: T.text, margin: "0 0 6px", letterSpacing: -0.5 }}>
            CAMPUS VOICE
          </h1>
          <p style={{ color: T.sub, fontSize: 12, margin: 0 }}>Administration · École AFI Dakar</p>
        </div>

        {/* Card formulaire */}
        <div style={{ background: T.card, borderRadius: 22, border: `1px solid ${T.border}`,
          padding: 32, boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
          <form onSubmit={submit}>
            <label style={{ fontSize: 10, color: T.sub, display: "block", marginBottom: 7,
              fontWeight: 700, letterSpacing: "0.08em" }}>MATRICULE ADMINISTRATEUR</label>
            <input value={matricule} onChange={e => setMatricule(e.target.value)}
              placeholder="Ex : AFI-001" required style={{ ...inp, marginBottom: 14 }}
              onFocus={e => e.target.style.borderColor = `${T.blue}70`}
              onBlur={e => e.target.style.borderColor = T.border} />

            <label style={{ fontSize: 10, color: T.sub, display: "block", marginBottom: 7,
              fontWeight: 700, letterSpacing: "0.08em" }}>MOT DE PASSE</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required style={{ ...inp, marginBottom: 22 }}
              onFocus={e => e.target.style.borderColor = `${T.blue}70`}
              onBlur={e => e.target.style.borderColor = T.border} />

            {erreur && (
              <div style={{ background: "rgba(200,16,46,0.1)", border: "1px solid rgba(200,16,46,0.25)",
                color: "#F87171", padding: "10px 14px", borderRadius: 10, fontSize: 12,
                marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                ⚠️ {erreur}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: "100%", padding: "13px 20px", borderRadius: 12, border: "none",
              background: loading ? "rgba(255,255,255,0.04)" : "linear-gradient(135deg,#C8102E,#8B0000)",
              color: "#fff", fontWeight: 700, fontSize: 14,
              cursor: loading ? "wait" : "pointer", fontFamily: "inherit",
              boxShadow: loading ? "none" : "0 4px 18px rgba(200,16,46,0.35)",
              transition: "all 0.2s",
            }}>
              {loading ? "Connexion en cours…" : "Se connecter →"}
            </button>
          </form>
        </div>
        <p style={{ textAlign: "center", fontSize: 11, color: T.muted, marginTop: 18 }}>
          Accès réservé aux administrateurs AFI
        </p>
      </div>
    </div>
  );
}

// ─── App principal ────────────────────────────────────────────────────────────
export default function App() {
  const [token,      setToken]      = useState(localStorage.getItem("cv_token") || "");
  const [user,       setUser]       = useState(null);
  const [page,       setPage]       = useState("dashboard");
  const [toast,      setToast]      = useState({ message: null, type: "info" });
  const [notifCount, setNotifCount] = useState(0);
  const wsRef = useRef(null);

  // ── Toast ──
  const showToast = useCallback((message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: null, type: "info" }), 4200);
  }, []);

  // ── Init après login ──
  useEffect(() => {
    if (!token) return;

    // Charger le profil
    getMe(token)
      .then(setUser)
      .catch(() => {
        // Token expiré ou invalide → déconnexion silencieuse
        localStorage.removeItem("cv_token");
        setToken(""); setUser(null);
      });

    // Charger le nombre de notifs non lues (silencieux)
    fetchNotifCount(token).then(setNotifCount);

    // Polling notifs toutes les 30s (évite problèmes WS)
    const interval = setInterval(() => {
      fetchNotifCount(token).then(setNotifCount);
    }, 30_000);

    // WebSocket (optionnel, ne crash pas si indisponible)
    try {
      const ws = new WebSocket(`ws://localhost:8000/ws/notifications`);
      wsRef.current = ws;

      ws.onopen = () => {
        // Ping régulier pour garder la connexion vivante
        const ping = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 20_000);
        ws._pingInterval = ping;
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "pong") return;
          setNotifCount(n => n + 1);
          showToast(`🔔 ${msg.titre || msg.title || "Nouveau signalement"}`, "info");
        } catch (_) {}
      };

      ws.onerror = () => { /* Silencieux — WS optionnel */ };
      ws.onclose = () => { clearInterval(ws._pingInterval); };
    } catch (_) {}

    return () => {
      clearInterval(interval);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (_) {}
      }
    };
  }, [token, showToast]);

  // ── Logout ──
  const handleLogout = () => {
    if (wsRef.current) { try { wsRef.current.close(); } catch (_) {} }
    localStorage.removeItem("cv_token");
    setToken(""); setUser(null); setPage("dashboard"); setNotifCount(0);
  };

  // ── Router ──
  const renderPage = () => {
    const props = { token, showToast };
    switch (page) {
      case "dashboard":    return <Dashboard        {...props} />;
      case "signalements": return <Signalements     {...props} />;
      case "notes":        return <PageNotes        {...props} />;
      case "planning":     return <PagePlanning     {...props} />;
      case "infos":        return <PageInfos        {...props} />;
      case "utilisateurs": return <PageUtilisateurs {...props} />;
      default:             return null;
    }
  };

  // ── Non connecté ──
  if (!token) {
    return (
      <>
        <GlobalStyles />
        <LoginPage onLogin={t => { setToken(t); }} />
      </>
    );
  }

  return (
    <>
      <GlobalStyles />
      <div style={{
        display: "flex", minHeight: "100vh",
        background: T.bg, color: T.text,
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      }}>
        <Toast message={toast.message} type={toast.type} />

        <Sidebar
          page={page}
          setPage={setPage}
          user={user}
          onLogout={handleLogout}
          notifCount={notifCount}
        />

        <main style={{ flex: 1, padding: "28px 36px", overflowY: "auto", minWidth: 0 }}>
          <div style={{ maxWidth: 1300, margin: "0 auto" }}>

            {/* Top bar */}
            <div style={{ display: "flex", justifyContent: "flex-end",
              alignItems: "center", gap: 10, marginBottom: 28 }}>
              {notifCount > 0 && (
                <div style={{
                  padding: "6px 13px", borderRadius: 9,
                  background: "rgba(200,16,46,0.09)",
                  border: "1px solid rgba(200,16,46,0.2)",
                  fontSize: 12, color: "#F87171",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%",
                    background: T.accent, animation: "cv-pulse 2s infinite" }} />
                  {notifCount} notification(s) non lue(s)
                </div>
              )}
              <div style={{
                padding: "6px 13px", borderRadius: 9, background: T.card,
                border: `1px solid ${T.border}`, fontSize: 12, color: T.sub,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.green }} />
                {user?.role?.replace(/_/g, " ") || "Admin"} · AFI {new Date().getFullYear()}
              </div>
            </div>

            {renderPage()}
          </div>
        </main>
      </div>

      {/* Keyframes supplémentaires */}
      <style>{`
        @keyframes cv-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </>
  );
}
