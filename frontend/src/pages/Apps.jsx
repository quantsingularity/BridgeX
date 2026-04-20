import React, { useEffect, useState } from "react";
import { admin } from "../api";
import {
  Card,
  SectionHeader,
  Table,
  Badge,
  Button,
  Input,
  Spinner,
  Alert,
  colors,
} from "../components/UI";
import { format } from "date-fns";

export default function Apps() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [sandbox, setSandbox] = useState(true);
  const [created, setCreated] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    admin
      .apps()
      .then((r) => setApps(r.data.apps))
      .catch(() => setError("Failed to load apps"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const r = await admin.createApp({
        name: name.trim(),
        sandbox_mode: sandbox,
      });
      setCreated(r.data);
      setName("");
      load();
    } catch (e) {
      setError(
        "Failed to create app: " + (e.response?.data?.error || e.message),
      );
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: "name", label: "Name" },
    {
      key: "client_id",
      label: "Client ID",
      render: (v) => <code style={{ fontSize: "11px" }}>{v}</code>,
    },
    {
      key: "sandbox_mode",
      label: "Mode",
      render: (v) => (
        <Badge
          status={v ? "pending" : "active"}
          label={v ? "Sandbox" : "Live"}
        />
      ),
    },
    {
      key: "is_active",
      label: "Active",
      render: (v) => (
        <Badge status={v ? "active" : "revoked"} label={v ? "Yes" : "No"} />
      ),
    },
    { key: "linked_institutions", label: "Linked" },
    {
      key: "webhook_url",
      label: "Webhook",
      render: (v) => (v ? "Configured" : "None"),
    },
    {
      key: "created_at",
      label: "Created",
      render: (v) => format(new Date(v), "dd MMM yyyy"),
    },
  ];

  return (
    <div>
      <SectionHeader
        title="Connected Apps"
        subtitle="Manage API client applications and their credentials"
        action={
          <Button onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancel" : "+ New App"}
          </Button>
        }
      />

      {error && <Alert type="error" message={error} />}

      {showForm && (
        <Card style={{ marginBottom: "20px" }}>
          <h3
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#f1f5f9",
              marginBottom: "16px",
            }}
          >
            Create App
          </h3>
          <Input
            label="App Name"
            placeholder="My Fintech App"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div
            style={{
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "13px",
            }}
          >
            <input
              type="checkbox"
              id="sandbox"
              checked={sandbox}
              onChange={(e) => setSandbox(e.target.checked)}
            />
            <label htmlFor="sandbox" style={{ color: colors.muted }}>
              Sandbox mode (no real bank connections)
            </label>
          </div>
          <div
            style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}
          >
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim() || saving}>
              {saving ? "Creating..." : "Create App"}
            </Button>
          </div>
        </Card>
      )}

      {created && (
        <Card
          style={{ marginBottom: "20px", borderColor: colors.green + "60" }}
        >
          <h3
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: colors.green,
              marginBottom: "12px",
            }}
          >
            App created - save these credentials now!
          </h3>
          <div style={{ fontSize: "13px", display: "grid", gap: "6px" }}>
            <div>
              <span style={{ color: colors.muted }}>Client ID:</span>{" "}
              <code
                style={{
                  background: "#0f1117",
                  padding: "2px 8px",
                  borderRadius: "4px",
                }}
              >
                {created.client_id}
              </code>
            </div>
            <div>
              <span style={{ color: colors.muted }}>Client Secret:</span>{" "}
              <code
                style={{
                  background: "#0f1117",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  color: colors.yellow,
                }}
              >
                {created.client_secret}
              </code>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            style={{ marginTop: "10px" }}
            onClick={() => setCreated(null)}
          >
            Dismiss
          </Button>
        </Card>
      )}

      <Card>
        {loading ? <Spinner /> : <Table columns={columns} rows={apps} />}
      </Card>
    </div>
  );
}
