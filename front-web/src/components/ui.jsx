// ─── Campus Voice — UI Components Library ────────────────────────────────────
import { useState } from "react";
import { T, CAT_COLOR, CAT_ICON, STATUT_META, URGENCE_COLOR } from "../theme.js";

// ─── SPINNER ──────────────────────────────────────────────────────────────────
export function Spinner({ message, small }) {
  if (small) {
    return (
      <span style={{
        display: "inline-block", width: 16, height: 16, borderRadius: "50%",
        border: `2px solid ${T.border}`, borderTop: `2px solid ${T.accent}`,
        animation: "cv-spin 0.7s linear infinite", verticalAlign: "middle",
      }} />
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: 48, gap: 14 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%",
        border: `2px solid ${T.border}`, borderTop: `2px solid ${T.accent}`,
        animation: "cv-spin 0.7s linear infinite" }} />
      {message && <p style={{ color: T.sub, fontSize: 13, margin: 0 }}>{message}</p>}
    </div>
  );
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
export function Toast({ message, type = "info" }) {
  if (!message) return null;
  const colors = { success: T.green, error: T.red, info: T.blue, warning: T.yellow };
  const icons  = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" };
  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 9999,
      background: T.card, border: `1px solid ${colors[type] || T.border}40`,
      borderLeft: `3px solid ${colors[type] || T.border}`,
      borderRadius: 12, padding: "12px 18px", color: T.text, fontSize: 13,
      boxShadow: "0 8px 32px rgba(0,0,0,0.45)", maxWidth: 360, display: "flex",
      alignItems: "center", gap: 10, animation: "cv-slideIn 0.25s ease",
    }}>
      <span>{icons[type]}</span>
      <span>{message}</span>
    </div>
  );
}

// ─── CARD ─────────────────────────────────────────────────────────────────────
export function Card({ children, padding = 20, style = {}, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: T.card, borderRadius: 16,
      border: `1px solid ${T.border}`, padding,
      transition: onClick ? "background 0.15s" : undefined,
      cursor: onClick ? "pointer" : undefined,
      ...style,
    }}
    onMouseEnter={onClick ? e => e.currentTarget.style.background = T.cardHover : undefined}
    onMouseLeave={onClick ? e => e.currentTarget.style.background = T.card : undefined}>
      {children}
    </div>
  );
}

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
export function KpiCard({ label, value, color, icon, sub }) {
  return (
    <Card style={{ position: "relative", overflow: "hidden" }}>
      <div style={{
        position: "absolute", top: -8, right: -8, fontSize: 56,
        opacity: 0.05, lineHeight: 1, pointerEvents: "none",
      }}>{icon}</div>
      <div style={{ fontSize: 10, color: T.sub, fontWeight: 700,
        letterSpacing: "0.08em", marginBottom: 12 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 34, fontWeight: 900, color,
        fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>{sub}</div>}
    </Card>
  );
}

// ─── BUTTON ───────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = "primary", small = false,
  disabled = false, style = {}, type = "button" }) {
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: small ? "6px 14px" : "10px 20px",
    borderRadius: small ? 8 : 10, border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit", fontWeight: 600,
    fontSize: small ? 12 : 13, transition: "all 0.15s",
    opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap", ...style,
  };
  const variants = {
    primary:   { background: "linear-gradient(135deg,#C8102E,#8B0000)", color: "#fff",
                 boxShadow: disabled ? "none" : "0 4px 14px rgba(200,16,46,0.3)" },
    secondary: { background: T.card, color: T.text, border: `1px solid ${T.border}` },
    ghost:     { background: "transparent", color: T.sub, border: `1px solid ${T.border}` },
    danger:    { background: "rgba(239,68,68,0.12)", color: "#F87171",
                 border: "1px solid rgba(239,68,46,0.22)" },
    success:   { background: "rgba(16,185,129,0.12)", color: "#34D399",
                 border: "1px solid rgba(16,185,129,0.22)" },
    blue:      { background: "rgba(59,130,246,0.12)", color: "#60A5FA",
                 border: "1px solid rgba(59,130,246,0.22)" },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ ...base, ...variants[variant] }}>
      {children}
    </button>
  );
}

// ─── INPUT ────────────────────────────────────────────────────────────────────
export function Input({ label, value, onChange, type = "text", placeholder,
  options, required, small, rows, disabled }) {
  const s = {
    width: "100%", padding: small ? "7px 11px" : "10px 14px",
    borderRadius: 8, border: `1px solid ${T.border}`,
    background: T.sidebar, color: T.text, fontSize: 13,
    outline: "none", boxSizing: "border-box", fontFamily: "inherit",
    transition: "border-color 0.2s",
    opacity: disabled ? 0.5 : 1,
  };
  const focusStyle = { borderColor: `${T.blue}80` };

  const handleFocus  = e => Object.assign(e.target.style, focusStyle);
  const handleBlur   = e => { e.target.style.borderColor = T.border; };

  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label style={{ fontSize: 10, color: T.sub, display: "block",
          marginBottom: 6, fontWeight: 700, letterSpacing: "0.07em" }}>
          {label}
        </label>
      )}
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)}
          required={required} disabled={disabled}
          style={{ ...s }} onFocus={handleFocus} onBlur={handleBlur}>
          <option value="">— Choisir —</option>
          {options.map(o => (
            <option key={o.value ?? o} value={o.value ?? o}>
              {o.label ?? o}
            </option>
          ))}
        </select>
      ) : rows ? (
        <textarea value={value} onChange={e => onChange(e.target.value)}
          rows={rows} placeholder={placeholder} required={required}
          disabled={disabled} style={{ ...s, resize: "vertical" }}
          onFocus={handleFocus} onBlur={handleBlur} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} required={required} disabled={disabled}
          style={s} onFocus={handleFocus} onBlur={handleBlur} />
      )}
    </div>
  );
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 520 }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 20, backdropFilter: "blur(2px)",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.card, borderRadius: 20,
        border: `1px solid ${T.border}`, width: "100%",
        maxWidth: width, maxHeight: "90vh", overflowY: "auto", padding: 28,
        boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        animation: "cv-fadeUp 0.2s ease",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: T.text, margin: 0 }}>
            {title}
          </h3>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: T.sub,
            fontSize: 18, cursor: "pointer", lineHeight: 1, padding: 4,
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── SECTION TITLE ────────────────────────────────────────────────────────────
export function SectionTitle({ children, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between",
      alignItems: "center", marginBottom: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {Array.isArray(children) ? children : <h2 style={{
          fontSize: 20, fontWeight: 900, color: T.text, margin: 0, letterSpacing: -0.3,
        }}>{children}</h2>}
      </div>
      {action && <div style={{ display: "flex", gap: 8 }}>{action}</div>}
    </div>
  );
}

// ─── BADGES ───────────────────────────────────────────────────────────────────
export function Pill({ children, color, bg, dot }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20,
      background: bg || "rgba(255,255,255,0.07)",
      color: color || T.sub, fontSize: 11, fontWeight: 600,
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: "50%",
        background: dot, flexShrink: 0 }} />}
      {children}
    </span>
  );
}

export function CatBadge({ cat }) {
  const color = CAT_COLOR[cat] || T.sub;
  const icon  = CAT_ICON[cat] || "📌";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11,
      color, fontWeight: 600, background: `${color}18`,
      padding: "3px 8px", borderRadius: 8,
    }}>
      {icon} {cat}
    </span>
  );
}

export function StatutBadge({ statut }) {
  const s = STATUT_META[statut] || { bg: "rgba(255,255,255,0.07)", text: T.sub,
    dot: T.muted, label: statut };
  return <Pill bg={s.bg} color={s.text} dot={s.dot}>{s.label}</Pill>;
}

export function UrgenceBadge({ n }) {
  const level = Math.min(n || 0, 5);
  const color = URGENCE_COLOR[level];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, color, fontWeight: 700 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      Urgence {level}/5
    </span>
  );
}

// ─── TABLE ────────────────────────────────────────────────────────────────────
export function DataTable({ headers, children, empty = "Aucune donnée" }) {
  return (
    <div>
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${headers.length}, 1fr)`,
        padding: "10px 18px",
        borderBottom: `1px solid ${T.border}`,
        fontSize: 10, fontWeight: 700, color: T.muted,
        letterSpacing: "0.07em",
      }}>
        {headers.map(h => <span key={h}>{h.toUpperCase()}</span>)}
      </div>
      {children || (
        <div style={{ textAlign: "center", padding: 40, color: T.muted, fontSize: 13 }}>
          {empty}
        </div>
      )}
    </div>
  );
}

// ─── BARRE DE PROGRESSION ─────────────────────────────────────────────────────
export function ProgressBar({ value, max, color, height = 6 }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ height, background: "rgba(255,255,255,0.05)", borderRadius: 4 }}>
      <div style={{
        height, width: `${pct}%`, borderRadius: 4, background: color,
        transition: "width 0.6s ease",
      }} />
    </div>
  );
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
export function EmptyState({ icon = "📭", message = "Aucune donnée", action }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 13, color: T.muted, marginBottom: action ? 16 : 0 }}>
        {message}
      </div>
      {action}
    </div>
  );
}

// ─── SELECT STATUT (inline dans une ligne) ────────────────────────────────────
export function StatutSelect({ statut, onChange }) {
  return (
    <select value={statut} onChange={e => { e.stopPropagation(); onChange(e.target.value); }}
      onClick={e => e.stopPropagation()}
      style={{
        padding: "5px 8px", borderRadius: 6, border: `1px solid ${T.border}`,
        background: T.sidebar, color: STATUT_META[statut]?.text || T.text,
        fontSize: 11, fontFamily: "inherit", cursor: "pointer",
      }}>
      {Object.entries(STATUT_META).map(([k, v]) => (
        <option key={k} value={k}>{v.label}</option>
      ))}
    </select>
  );
}

// ─── ALERT BANNER ─────────────────────────────────────────────────────────────
export function AlertBanner({ items = [], type = "danger" }) {
  if (!items.length) return null;
  const colors = {
    danger:  { bg: "rgba(200,16,46,0.07)",  border: "rgba(200,16,46,0.2)",  text: "#F87171" },
    warning: { bg: "rgba(245,158,11,0.07)", border: "rgba(245,158,11,0.2)", text: "#FCD34D" },
  };
  const c = colors[type];
  return (
    <div style={{
      padding: "14px 18px", borderRadius: 14,
      background: c.bg, border: `1px solid ${c.border}`,
      marginBottom: 20,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: c.text, marginBottom: 10 }}>
        🚨 {items.length} alerte(s) active(s)
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {items.map((item, i) => (
          <div key={i} style={{
            padding: "5px 12px", borderRadius: 8,
            background: `${c.border}`, fontSize: 12, color: c.text,
          }}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── DIVIDER ──────────────────────────────────────────────────────────────────
export function Divider() {
  return <div style={{ height: 1, background: T.border, margin: "16px 0" }} />;
}

// ─── GLOBAL STYLES (à injecter via <GlobalStyles /> dans App) ─────────────────
export function GlobalStyles() {
  return (
    <style>{`
      @keyframes cv-spin    { to { transform: rotate(360deg); } }
      @keyframes cv-slideIn { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }
      @keyframes cv-fadeUp  { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
      * { scrollbar-width: thin; scrollbar-color: rgba(99,179,237,0.12) transparent; }
      ::-webkit-scrollbar { width: 5px; height: 5px; }
      ::-webkit-scrollbar-thumb { background: rgba(99,179,237,0.14); border-radius: 10px; }
      select option { background: #0D1525; color: #EDF2FF; }
      * { box-sizing: border-box; }
    `}</style>
  );
}
