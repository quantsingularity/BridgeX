import React from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Institutions from "./pages/Institutions";
import TokenHealth from "./pages/TokenHealth";
import WebhookLogs from "./pages/WebhookLogs";
import Apps from "./pages/Apps";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/institutions" element={<Institutions />} />
        <Route path="/tokens" element={<TokenHealth />} />
        <Route path="/webhooks" element={<WebhookLogs />} />
        <Route path="/apps" element={<Apps />} />
      </Routes>
    </Layout>
  );
}
