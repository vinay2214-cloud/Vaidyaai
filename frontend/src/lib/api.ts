import axios from "axios";
import { getFirebaseAuth } from "./firebase";
import { BACKEND_URL } from "./constants";
import { logout, isDevAuthBypassEnabled } from "./auth";

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api/v1`,
  timeout: 10000, // default 10s
  headers: {
    "Content-Type": "application/json"
  }
});

api.interceptors.request.use(async (config) => {
  // Attach correlation ID
  if (!config.headers["X-Correlation-ID"]) {
    config.headers["X-Correlation-ID"] = `corr_fe_${Math.random().toString(36).substring(2, 11)}`;
  }

  // Tiered timeout assignment based on URL path
  const url = config.url || "";
  if (url.includes("/export-") || url.includes("/generate-report")) {
    config.timeout = 30000; // 30s for heavy exports
  } else if (url.includes("/transcribe") || url.includes("/check-safety") || url.includes("/referral")) {
    config.timeout = 60000; // 60s for live multi-modal STT & Gemini 2.5 Pro reasoning
  } else if (config.method?.toUpperCase() === "GET") {
    config.timeout = 5000; // 5s for fast read operations
  }

  if (isDevAuthBypassEnabled()) {
    config.headers.Authorization = `Bearer dev_mock_id_token`;
  } else if (typeof window !== "undefined") {
    const auth = getFirebaseAuth();
    const user = auth?.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const config = error?.config;

    if (
      (status === 401 || status === 403) &&
      !isDevAuthBypassEnabled() &&
      !config?.url?.includes("/clinics/dev-provision") &&
      !config?.url?.includes("/clinics/setup")
    ) {
      console.warn(`[VaidyaAI API Interceptor] 401/403 Unauthorized on ${config?.url}. Triggering sign-out.`);
      logout();
      return Promise.reject(error);
    }

    // 1-retry logic for network timeout or 503 service unavailable
    if (config && !config._retry && (error.code === "ECONNABORTED" || status === 503)) {
      config._retry = true;
      console.warn(`Retrying API call to ${config.url} due to transient network failure (${error.code || status})...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return api(config);
    }

    return Promise.reject(error);
  }
);

export default api;
