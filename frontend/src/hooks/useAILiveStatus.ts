import { useCallback, useEffect, useState } from "react";
import api from "../lib/api";
import { apiErrorMessage } from "../lib/errors";

/**
 * Live Gemini/Vertex execution telemetry from the backend.
 *
 * This is the evidence that clinical AI is genuinely executing against Vertex
 * AI rather than a mock: which model answered, in which region, how long it
 * took, and whether mock fallback is permitted at all. It is served by
 * GET /api/v1/ai/live-status and reflects the *last real execution*, so it
 * cannot be faked by the frontend.
 */
export interface AILiveStatus {
  vertex_ai_initialized: boolean;
  authentication: string;
  reasoning_model: string;
  reasoning_location: string;
  fast_model: string;
  fast_location: string;
  last_live_execution: string | null;
  last_live_model: string | null;
  last_live_location: string | null;
  last_live_latency_ms: number | null;
  last_execution_status: string;
  live_clinical_ai_enabled: boolean;
  mock_fallback_allowed: boolean;
}

export function useAILiveStatus(pollMs: number = 30000) {
  const [status, setStatus] = useState<AILiveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get("/ai/live-status");
      setStatus(res.data);
      setError(null);
    } catch (e) {
      setStatus((current) => {
        if (current === null) {
          setError(apiErrorMessage(e, "load AI execution telemetry"));
        }
        return current;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (pollMs <= 0) return;
    const interval = setInterval(refresh, pollMs);
    return () => clearInterval(interval);
  }, [refresh, pollMs]);

  /**
   * "Verified" means the backend has actually completed a live Vertex call,
   * not merely that credentials are present. Deliberately strict: claiming
   * verification without a successful execution behind it is exactly the kind
   * of decorative badge this dashboard must not ship.
   */
  const isLiveVerified = Boolean(
    status?.live_clinical_ai_enabled &&
      !status?.mock_fallback_allowed &&
      status?.last_execution_status === "success"
  );

  const isConfigured = Boolean(
    status?.live_clinical_ai_enabled && !status?.mock_fallback_allowed
  );

  return { status, loading, error, refresh, isLiveVerified, isConfigured };
}
