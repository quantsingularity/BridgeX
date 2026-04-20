import React from "react";

const T = {
  bg: "#0f1117",
  surface: "#1a1f2e",
  border: "#2a3248",
  accent: "#6366f1",
  text: "#e2e8f0",
  muted: "#64748b",
  green: "#10b981",
  yellow: "#f59e0b",
  red: "#ef4444",
  blue: "#3b82f6",
};

const STATUS_COLORS = {
  active: { bg: "#064e3b", color: "#34d399" },
  expired: { bg: "#451a03", color: "#fbbf24" },
  revoked: { bg: "#4c0519", color: "#f87171" },
  error: { bg: "#4c0519", color: "#f87171" },
  pending: { bg: "#1e3a5f", color: "#60a5fa" },
  delivered: { bg: "#064e3b", color: "#34d399" },
  failed: { bg: "#4c0519", color: "#f87171" },
  retrying: { bg: "#451a03", color: "#fbbf24" },
};

export function Badge({ status, label }) {
  const s = STATUS_COLORS[status] || { bg: "#1a1f2e", color: "#94a3b8" };
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        background: s.bg,
        color: s.color,
      }}
    >
      {label || status}
    </span>
  );
}

export function Card({ children, style = {} }) {
  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: "12px",
        padding: "20px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function StatCard({ label, value, color = T.accent }) {
  return (
    <Card style={{ flex: 1, textAlign: "center" }}>
      <div style={{ fontSize: "30px", fontWeight: 700, color }}>
        {value ?? "-"}
      </div>
      <div style={{ fontSize: "13px", color: T.muted, marginTop: "4px" }}>
        {label}
      </div>
    </Card>
  );
}

export function Table({ columns, rows, onRowClick }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}
      >
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  padding: "10px 14px",
                  textAlign: "left",
                  color: T.muted,
                  fontWeight: 600,
                  borderBottom: `1px solid ${T.border}`,
                  whiteSpace: "nowrap",
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ padding: "32px", textAlign: "center", color: T.muted }}
              >
                No records
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                onClick={() => onRowClick && onRowClick(row)}
                style={{
                  borderBottom: `1px solid ${T.border}`,
                  cursor: onRowClick ? "pointer" : "default",
                }}
                onMouseEnter={(e) => {
                  if (onRowClick) e.currentTarget.style.background = "#1e2538";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    style={{ padding: "10px 14px", color: T.text }}
                  >
                    {c.render ? c.render(row[c.key], row) : (row[c.key] ?? "-")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled,
  style = {},
}) {
  const bg =
    variant === "primary" ? T.accent : variant === "danger" ? T.red : T.surface;
  const clr = variant === "ghost" ? T.muted : "#fff";
  const pad = size === "sm" ? "5px 12px" : "9px 18px";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: pad,
        background: disabled ? T.border : bg,
        color: disabled ? T.muted : clr,
        border: variant === "ghost" ? `1px solid ${T.border}` : "none",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      {label && (
        <label
          style={{
            display: "block",
            fontSize: "12px",
            color: T.muted,
            marginBottom: "4px",
            fontWeight: 500,
          }}
        >
          {label}
        </label>
      )}
      <input
        {...props}
        style={{
          width: "100%",
          background: "#0f1117",
          border: `1px solid ${T.border}`,
          borderRadius: "8px",
          padding: "8px 12px",
          color: T.text,
          fontSize: "13px",
          outline: "none",
        }}
      />
    </div>
  );
}

export function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
      <div
        style={{
          width: "32px",
          height: "32px",
          border: "3px solid #2a3248",
          borderTop: "3px solid #6366f1",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function Alert({ type = "info", message }) {
  const c = { error: T.red, success: T.green, warning: T.yellow, info: T.blue };
  const b = {
    error: "#2d0a0a",
    success: "#022c22",
    warning: "#1c0f00",
    info: "#0c1a2e",
  };
  return (
    <div
      style={{
        padding: "12px 16px",
        borderRadius: "8px",
        border: `1px solid ${c[type]}30`,
        background: b[type],
        color: c[type],
        fontSize: "13px",
        marginBottom: "16px",
      }}
    >
      {message}
    </div>
  );
}

export function SectionHeader({ title, subtitle, action }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: "20px",
      }}
    >
      <div>
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#f1f5f9" }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: "13px", color: T.muted, marginTop: "3px" }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export const colors = T;
