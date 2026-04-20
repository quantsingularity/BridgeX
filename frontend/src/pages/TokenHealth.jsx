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

export default function TokenHealth() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    admin
      .tokens()
      .then((r) => setTokens(r.data.tokens))
      .catch(() => setError("Failed to load tokens"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const columns = [
    { key: "app_name", label: "App" },
    { key: "institution_name", label: "Institution" },
    { key: "status", label: "Status", render: (v) => <Badge status={v} /> },
    {
      key: "scopes",
      label: "Scopes",
      render: (v) => (v || []).join(", ") || "-",
    },
    {
      key: "last_used_at",
      label: "Last Used",
      render: (v) => (v ? format(new Date(v), "dd MMM HH:mm") : "Never"),
    },
    {
      key: "token_expires_at",
      label: "Expires",
      render: (v) => (v ? format(new Date(v), "dd MMM yyyy HH:mm") : "Never"),
    },
  ];

  return (
    <div>
      <SectionHeader
        title="Token Health"
        subtitle="Institution access tokens and their status"
        action={
          <Button size="sm" variant="ghost" onClick={load}>
            Refresh
          </Button>
        }
      />
      {error && <Alert type="error" message={error} />}
      <Card>
        {loading ? (
          <Spinner />
        ) : (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "14px",
                fontSize: "13px",
                color: colors.muted,
              }}
            >
              <span>{tokens.length} tokens</span>
              <span>
                Active: {tokens.filter((t) => t.status === "active").length} /
                Expired: {tokens.filter((t) => t.status === "expired").length} /
                Revoked: {tokens.filter((t) => t.status === "revoked").length}
              </span>
            </div>
            <Table columns={columns} rows={tokens} />
          </>
        )}
      </Card>
    </div>
  );
}
