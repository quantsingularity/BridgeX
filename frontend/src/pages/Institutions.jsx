import React, { useEffect, useState } from "react";
import { institutions as instsApi } from "../api";
import { Card, SectionHeader, Spinner, Alert, colors } from "../components/UI";

export default function Institutions() {
  const [list, setList] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    instsApi
      .list()
      .then((r) => setList(r.data.institutions))
      .catch(() => setError("Failed to load institutions"));
  }, []);

  if (error) return <Alert type="error" message={error} />;
  if (!list.length) return <Spinner />;

  return (
    <div>
      <SectionHeader
        title="Institutions"
        subtitle="5 mock bank adapters available in BridgeX"
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "16px",
        }}
      >
        {list.map((inst) => (
          <Card
            key={inst.id}
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "10px",
                  background: inst.primaryColor + "22",
                  border: `2px solid ${inst.primaryColor}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  fontWeight: 800,
                  color: inst.primaryColor,
                }}
              >
                {inst.name[0]}
              </div>
              <div>
                <div style={{ fontWeight: 600, color: "#f1f5f9" }}>
                  {inst.name}
                </div>
                <div style={{ fontSize: "12px", color: colors.muted }}>
                  {inst.id} - {inst.country}
                </div>
              </div>
            </div>
            <div style={{ fontSize: "12px", color: colors.muted }}>
              OAuth: {inst.oauthSupported ? "Supported" : "Not supported"}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
