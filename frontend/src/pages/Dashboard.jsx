import React, { useEffect, useState } from "react";
import { admin } from "../api";
import {
  Card,
  StatCard,
  Spinner,
  Alert,
  Badge,
  colors,
} from "../components/UI";
import { format } from "date-fns";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    admin
      .stats()
      .then((r) => setData(r.data))
      .catch(() =>
        setError("Could not load dashboard. Is the server running?"),
      );
  }, []);

  if (error) return <Alert type="error" message={error} />;
  if (!data) return <Spinner />;

  const { stats, institutions_summary, recent_deliveries } = data;

  return (
    <div>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#f1f5f9" }}>
          Dashboard
        </h1>
        <p style={{ color: colors.muted, fontSize: "13px", marginTop: "4px" }}>
          BridgeX Open Banking Platform Overview
        </p>
      </div>

      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        <StatCard
          label="Connected Apps"
          value={stats.total_apps}
          color="#818cf8"
        />
        <StatCard
          label="Active Tokens"
          value={stats.active_tokens}
          color={colors.green}
        />
        <StatCard
          label="Pending Webhooks"
          value={stats.pending_webhooks}
          color={colors.yellow}
        />
        <StatCard
          label="Total Deliveries"
          value={stats.total_deliveries}
          color={colors.blue}
        />
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}
      >
        <Card>
          <h3
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#f1f5f9",
              marginBottom: "14px",
            }}
          >
            Linked Institutions
          </h3>
          {institutions_summary.length === 0 ? (
            <p style={{ color: colors.muted, fontSize: "13px" }}>
              No institutions linked yet.
            </p>
          ) : (
            institutions_summary.map((inst, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                <span style={{ fontSize: "13px", textTransform: "capitalize" }}>
                  {inst.institution_id.replace(/_/g, " ")}
                </span>
                <Badge status="active" label={`${inst.linked_count} linked`} />
              </div>
            ))
          )}
        </Card>

        <Card>
          <h3
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#f1f5f9",
              marginBottom: "14px",
            }}
          >
            Recent Webhook Deliveries
          </h3>
          {recent_deliveries.length === 0 ? (
            <p style={{ color: colors.muted, fontSize: "13px" }}>
              No deliveries yet.
            </p>
          ) : (
            recent_deliveries.slice(0, 8).map((d, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 0",
                  borderBottom: `1px solid ${colors.border}`,
                  fontSize: "12px",
                }}
              >
                <div>
                  <code style={{ color: "#a5b4fc", marginRight: "8px" }}>
                    {d.event_type}
                  </code>
                  <Badge status={d.status} />
                </div>
                <span style={{ color: colors.muted }}>
                  {format(new Date(d.created_at), "dd MMM HH:mm")}
                </span>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
