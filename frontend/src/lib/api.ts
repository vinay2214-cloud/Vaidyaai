import axios from "axios";
import { getAuthenticatedUser } from "./firebase";
import { BACKEND_URL } from "./constants";
import { logout, isDevAuthBypassEnabled } from "./auth";

/**
 * Resolve the current bearer token for the authenticated user.
 *
 * Single source of truth for authentication so the axios API client and the
 * fetch-based SSE stream share the exact same credential. In development with
 * the auth bypass flag enabled this returns the dev mock token; otherwise it
 * mints a fresh Firebase ID token from the signed-in user.
 *
 * Returns null when no authenticated user is available (caller must not send
 * an Authorization header in that case).
 *
 * IMPORTANT: this awaits the Firebase persistence restore via
 * getAuthenticatedUser() instead of reading `auth.currentUser` synchronously.
 * Reading currentUser directly races the IndexedDB session restore on page load
 * and returns null for a perfectly valid session, producing a token-less request
 * that the backend rejects with 401 -> spurious sign-out -> bounce to /login.
 */
export async function getAuthToken(): Promise<string | null> {
  if (isDevAuthBypassEnabled()) {
    return "dev_mock_id_token";
  }
  if (typeof window !== "undefined") {
    const user = await getAuthenticatedUser();
    if (user) {
      return await user.getIdToken();
    }
  }
  return null;
}

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

  const token = await getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Record whether this request actually carried a credential. A 401 on a
  // request that never had a token is NOT evidence of an expired session, so it
  // must not trigger a sign-out.
  (config as any)._hadAuthToken = Boolean(token);
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const config = error?.config;

    // Distinguish authentication failure (401) from authorization failure (403).
    // 401 = the Firebase session is invalid/expired -> sign out so the user can
    //       re-authenticate.
    // 403 = the user IS authenticated but lacks access to the requested clinic /
    //       resource -> DO NOT destroy the valid Firebase session. Preserve it and
    //       surface the authorization error so the user can recover (e.g. fix the
    //       clinic mapping) instead of being silently bounced to /login.
    if (
      status === 401 &&
      !isDevAuthBypassEnabled() &&
      !config?.url?.includes("/clinics/dev-provision") &&
      !config?.url?.includes("/clinics/setup")
    ) {
      // Only sign out when the request actually presented a Firebase credential
      // and the backend still rejected it -- that is a genuinely invalid/expired
      // session. A 401 on a request that carried no token means the auth state
      // had not finished restoring; signing out there would destroy a valid
      // session and bounce the user to /login (the production login-loop bug).
      const hadToken = (config as any)?._hadAuthToken;
      if (!hadToken) {
        console.warn(
          `[VaidyaAI API Interceptor] 401 on ${config?.url} for a request with no credential ` +
          `(auth state not yet restored). Preserving session; not signing out.`
        );
        return Promise.reject(error);
      }
      console.warn(`[VaidyaAI API Interceptor] 401 on ${config?.url}. Firebase session invalid/expired. Signing out.`);
      logout();
      return Promise.reject(error);
    }

    if (status === 403 && !isDevAuthBypassEnabled()) {
      console.warn(
        `[VaidyaAI API Interceptor] 403 on ${config?.url}. User is authenticated but not authorized. ` +
        `Preserving the Firebase session; the caller will surface the authorization error.`
      );
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
