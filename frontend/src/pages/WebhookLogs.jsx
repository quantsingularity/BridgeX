import React, { useEffect, useState } from "react";
import { admin } from "../api";
import {
  Card,
  SectionHeader,
  Table,
  Badge,
  Spinner,
  Alert,
  Button,
  colors,
} from "../components/UI";
import { format } from "date-fns";

export default function WebhookLogs() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    admin
      .webhooks(200)
      .then((r) => setRows(r.data.deliveries))
      .catch(() => setError("Failed to load webhook logs"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const columns = [
    { key: "app_name", label: "App" },
    {
      key: "event_type",
      label: "Event",
      render: (v) => (
        <code
          style={{
            fontSize: "11px",
            background: "#1e2538",
            padding: "2px 6px",
            borderRadius: "4px",
            color: "#a5b4fc",
          }}
        >
          {v}
        </code>
      ),
    },
    { key: "status", label: "Status", render: (v) => <Badge status={v} /> },
    { key: "attempts", label: "Attempts" },
    { key: "response_code", label: "HTTP", render: (v) => v || "-" },
    {
      key: "delivered_at",
      label: "Delivered",
      render: (v) => (v ? format(new Date(v), "dd MMM HH:mm:ss") : "-"),
    },
    {
      key: "created_at",
      label: "Created",
      render: (v) => format(new Date(v), "dd MMM HH:mm:ss"),
    },
  ];

  const delivered = rows.filter((r) => r.status === "delivered").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const pending = rows.filter((r) =>
    ["pending", "retrying"].includes(r.status),
  ).length;

  return (
    <div>
      <SectionHeader
        title="Webhook Delivery Logs"
        subtitle="All webhook delivery attempts across all connected apps"
        action={
          <Button size="sm" variant="ghost" onClick={load}>
            Refresh
          </Button>
        }
      />
      {error && <Alert type="error" message={error} />}

      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        {[
          { label: "Delivered", value: delivered, color: colors.green },
          { label: "Failed", value: failed, color: colors.red },
          { label: "Pending", value: pending, color: colors.yellow },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: "10px",
              padding: "12px 20px",
              textAlign: "center",
              flex: 1,
            }}
          >
            <div style={{ fontSize: "24px", fontWeight: 700, color: s.color }}>
              {s.value}
            </div>
            <div style={{ fontSize: "12px", color: colors.muted }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <Card>
        {loading ? <Spinner /> : <Table columns={columns} rows={rows} />}
      </Card>
    </div>
  );
}
