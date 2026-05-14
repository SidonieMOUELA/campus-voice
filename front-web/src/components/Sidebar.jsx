// ─── Sidebar.jsx ──────────────────────────────────────────────────────────────
import { T, NAV_ITEMS } from "../theme.js";

export default function Sidebar({ page, setPage, user, onLogout, notifCount = 0 }) {
  return (
    <aside style={{
      width: 224, minHeight: "100vh", background: T.sidebar,
      borderRight: `1px solid ${T.border}`, display: "flex",
      flexDirection: "column", flexShrink: 0,
    }}>
      {/* ── Logo ── */}
      <div style={{ padding: "22px 18px 18px", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            background: "linear-gradient(135deg,#C8102E,#8B0000)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 15, color: "#fff",
            boxShadow: "0 4px 14px rgba(200,16,46,0.35)",
          }}>CV</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.text, letterSpacing: -0.3 }}>
              CAMPUS VOICE
            </div>
            <div style={{ fontSize: 9, color: T.muted, letterSpacing: "0.05em" }}>
              ADMINISTRATION AFI
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, padding: "16px 10px" }}>
        <div style={{
          fontSize: 9, color: T.muted, fontWeight: 700,
          letterSpacing: "0.1em", padding: "0 10px", marginBottom: 8,
        }}>NAVIGATION</div>

        {NAV_ITEMS.map(n => {
          const isActive = page === n.id;
          const badge = n.id === "signalements" && notifCount > 0 ? notifCount : null;

          return (
            <button key={n.id} onClick={() => setPage(n.id)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 10, border: "none",
              cursor: "pointer", fontFamily: "inherit", fontSize: 13,
              background: isActive ? "rgba(200,16,46,0.14)" : "transparent",
              color: isActive ? T.text : T.sub,
              fontWeight: isActive ? 600 : 400,
              marginBottom: 2, transition: "all 0.14s",
              borderLeft: `2px solid ${isActive ? T.accent : "transparent"}`,
            }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{n.icon}</span>
              <span style={{ flex: 1, textAlign: "left" }}>{n.label}</span>
              {badge && (
                <span style={{
                  background: T.accent, color: "#fff", borderRadius: 20,
                  fontSize: 9, fontWeight: 700, padding: "1px 6px",
                  minWidth: 18, textAlign: "center",
                }}>
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
              {isActive && (
                <span style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: T.accent, flexShrink: 0,
                }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Utilisateur connecté ── */}
      <div style={{ padding: "14px 14px 18px", borderTop: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg,#3B82F6,#8B5CF6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 13, color: "#fff",
          }}>
            {user ? `${user.prenom?.[0] || ""}${user.nom?.[0] || ""}` : "GA"}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: T.text,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {user ? `${user.prenom} ${user.nom}` : "Administrateur"}
            </div>
            <div style={{
              fontSize: 10, color: T.green,
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.green }} />
              {user?.role?.replace("_", " ") || "En ligne"}
            </div>
          </div>
        </div>

        <button onClick={onLogout} style={{
          width: "100%", padding: "8px", borderRadius: 8,
          border: `1px solid ${T.border}`, background: "transparent",
          color: T.sub, fontSize: 11, cursor: "pointer",
          fontFamily: "inherit", transition: "all 0.14s",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = `${T.accent}40`; e.currentTarget.style.color = T.text; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.sub; }}>
          🔓 Déconnexion
        </button>
      </div>
    </aside>
  );
}
