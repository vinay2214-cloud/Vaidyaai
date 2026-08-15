import { useEffect, useRef, useState } from "react";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { getFirestoreDb } from "../lib/firebase";
import { useClinicStore } from "../store/clinicStore";
import { BACKEND_URL } from "@/lib/constants";
import { getAuthToken } from "@/lib/api";

export interface AgentLog {
  id: string;
  agent_name: string;
  decision_type: string;
  decision_made: string;
  clinic_id: string;
  input_summary?: string;
  output_summary?: string;
  model_used?: string;
  latency_ms?: number;
  patient_phone_masked?: string;
  success?: boolean;
  created_at?: any;
  patient_id?: string;
  consultation_id?: string;
}

export type StreamStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

const MAX_LOGS = 50;
const RECONNECT_DELAY_MS = 3000;

/**
 * Fetch-based Server-Sent Events client.
 *
 * Browser `EventSource` cannot attach an `Authorization` header, so we stream
 * the `text/event-stream` response via `fetch` with the same bearer token the
 * axios API client uses. This keeps backend authentication intact (no token in
 * the URL, no unauthenticated SSE) while enabling real-time agent observability.
 */
async function streamEvents(
  url: string,
  token: string | null,
  handlers: {
    onOpen: () => void;
    onEvent: (data: any) => void;
    onError: () => void;
  },
  signal: AbortSignal
): Promise<void> {
  const headers: Record<string, string> = { Accept: "text/event-stream" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers, signal, cache: "no-store" });
  if (!res.ok || !res.body) {
    throw new Error(`SSE stream failed with status ${res.status}`);
  }

  handlers.onOpen();

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by a blank line.
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      const lines = part.split("\n");
      let eventType = "message";
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          data += line.slice(5).trim();
        }
      }
      if (eventType === "event" && data) {
        try {
          handlers.onEvent(JSON.parse(data));
        } catch {
          // ignore malformed event payloads
        }
      }
    }
  }
}

export function useAgentLogs(filterAgent?: string | null) {
  const clinicId = useClinicStore((state) => state.clinicId);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting");
  const seenIds = useRef<Set<string>>(new Set());

  // Real-time transport: authenticated fetch-based SSE stream from the backend
  // event bus, with Firestore onSnapshot as a fallback for environments without
  // a live stream.
  useEffect(() => {
    if (!clinicId) {
      setLoading(false);
      setStreamStatus("disconnected");
      return;
    }

    let controller: AbortController | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const connect = async () => {
      if (cancelled) return;
      setStreamStatus("connecting");
      try {
        const token = await getAuthToken();
        if (cancelled) return;
        controller = new AbortController();
        await streamEvents(
          `${BACKEND_URL}/api/v1/stream/events`,
          token,
          {
            onOpen: () => {
              if (!cancelled) {
                setStreamStatus("connected");
                setLoading(false);
              }
            },
            onEvent: (data) => {
              if (cancelled) return;
              const eventId = data.event_id || `evt_${Date.now()}_${Math.random()}`;
              if (seenIds.current.has(eventId)) return; // dedup
              seenIds.current.add(eventId);
              const log: AgentLog = {
                id: eventId,
                agent_name: data.event_type || "event",
                decision_type: `event:${data.event_type || "unknown"}`,
                decision_made: data.payload?.decision_made || `Emitted ${data.event_type || "event"}`,
                clinic_id: data.clinic_id || clinicId,
                patient_id: data.patient_id,
                consultation_id: data.consultation_id,
                created_at: data.created_at ? new Date(data.created_at) : new Date(),
                success: true,
              };
              if (!filterAgent || log.agent_name === filterAgent) {
                setLogs((prev) => [log, ...prev].slice(0, MAX_LOGS));
              }
            },
            onError: () => {
              if (cancelled) return;
              setStreamStatus("reconnecting");
            },
          },
          controller.signal
        );
        // Stream ended cleanly (server closed). Treat as disconnected.
        if (!cancelled) {
          setStreamStatus("disconnected");
          setLoading(false);
        }
      } catch (e) {
        if (cancelled) return;
        // AbortError means we intentionally closed the connection.
        if ((e as Error)?.name === "AbortError") return;
        setStreamStatus("reconnecting");
        setLoading(false);
      }

      if (cancelled) return;
      // Schedule a manual reconnect after a transient disconnect.
      reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      controller?.abort();
    };
  }, [clinicId, filterAgent]);

  // Firestore fallback: seed the list with persisted logs when the stream is
  // not available (e.g. dev in-memory Firestore).
  useEffect(() => {
    if (!clinicId) return;
    const db = getFirestoreDb();
    if (!db) return;

    let q = query(
      collection(db, "agent_logs"),
      where("clinic_id", "==", clinicId),
      orderBy("created_at", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: AgentLog[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        if (!filterAgent || d.agent_name === filterAgent) {
          docs.push({
            id: doc.id,
            agent_name: d.agent_name,
            decision_type: d.decision_type,
            decision_made: d.decision_made,
            clinic_id: d.clinic_id,
            input_summary: d.input_summary,
            output_summary: d.output_summary,
            model_used: d.model_used,
            latency_ms: d.latency_ms,
            patient_phone_masked: d.patient_phone_masked,
            success: d.success !== false,
            created_at: d.created_at,
            patient_id: d.patient_id,
            consultation_id: d.consultation_id
          });
        }
      });
      setLogs((prev) => {
        const merged = [...docs, ...prev];
        const seen = new Set<string>();
        return merged.filter((l) => {
          const key = l.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, MAX_LOGS);
      });
      setLoading(false);
    }, (error) => {
      console.warn("Agent logs onSnapshot error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [clinicId, filterAgent]);

  return { logs, loading, streamStatus };
}
