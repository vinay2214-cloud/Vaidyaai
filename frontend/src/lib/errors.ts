/**
 * Single place that turns a thrown API error into something a doctor can read.
 *
 * WHY THIS EXISTS: failures were previously swallowed into console.warn, so a
 * clinic-side failure looked identical to "no data" — an empty list or a
 * spinner that never resolved. Every call site needs the same two answers:
 * what do I tell the user, and is it worth offering a Retry button.
 */

export interface ApiErrorInfo {
  /** Human-readable sentence, safe to show directly in a toast or card. */
  message: string;
  /** True when the failure is plausibly transient and a Retry makes sense. */
  retryable: boolean;
  /** HTTP status when the request reached the server. */
  status?: number;
}

/** FastAPI returns `{"detail": "..."}`; detail is occasionally a validation array. */
function extractDetail(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const detail = (data as { detail?: unknown }).detail;
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: unknown };
    if (typeof first?.msg === "string") return first.msg;
  }
  return null;
}

/**
 * @param error   the value caught from a rejected api call
 * @param action  what the user was trying to do, lowercase and verb-first,
 *                e.g. "register the patient" — used to build the fallback
 *                sentence: "Could not register the patient."
 */
export function describeApiError(error: unknown, action: string): ApiErrorInfo {
  const err = error as {
    code?: string;
    message?: string;
    response?: { status?: number; data?: unknown };
  };
  const status = err?.response?.status;
  const serverDetail = extractDetail(err?.response?.data);

  // No response at all: network down, DNS, CORS, or the request timed out.
  if (!status) {
    const timedOut = err?.code === "ECONNABORTED";
    return {
      message: timedOut
        ? `Timed out trying to ${action}. The server is taking longer than usual — please try again in a moment.`
        : `Could not reach VaidyaAI services to ${action}. Please check your connection and try again.`,
      retryable: true,
    };
  }

  if (status === 401) {
    return {
      message: "Your session has expired. Please sign in again.",
      retryable: false,
      status,
    };
  }

  if (status === 403) {
    return {
      message:
        serverDetail ||
        "You do not have access to this clinic record. Please contact your clinic administrator.",
      retryable: false,
      status,
    };
  }

  if (status === 404) {
    return {
      message: serverDetail || "That record no longer exists. It may have been removed.",
      retryable: false,
      status,
    };
  }

  // 422 carries a real validation message from the backend — always show it,
  // since it tells the user exactly which field to fix.
  if (status === 422 || status === 400) {
    return {
      message: serverDetail || `Could not ${action} — some of the details provided are not valid.`,
      retryable: false,
      status,
    };
  }

  if (status === 429) {
    return {
      message: "Too many requests in a short time. Please wait a moment and try again.",
      retryable: true,
      status,
    };
  }

  if (status >= 500) {
    return {
      message: `VaidyaAI could not ${action} because of a server error. Please try again in a moment — if it keeps happening, contact support.`,
      retryable: true,
      status,
    };
  }

  return {
    message: serverDetail || `Could not ${action}. Please try again.`,
    retryable: true,
    status,
  };
}

/** Convenience for call sites that only need the sentence. */
export function apiErrorMessage(error: unknown, action: string): string {
  return describeApiError(error, action).message;
}
