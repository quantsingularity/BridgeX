import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

const api = axios.create({ baseURL: BASE, timeout: 15000 });

export const admin = {
  stats: () => api.get("/v1/admin/stats"),
  apps: () => api.get("/v1/admin/apps"),
  createApp: (data) => api.post("/v1/admin/apps", data),
  tokens: () => api.get("/v1/admin/tokens"),
  webhooks: (limit = 100) => api.get(`/v1/admin/webhooks?limit=${limit}`),
  audit: (limit = 100) => api.get(`/v1/admin/audit?limit=${limit}`),
};

export const institutions = {
  list: () => api.get("/v1/institutions"),
  get: (id) => api.get(`/v1/institutions/${id}`),
};

export default api;
