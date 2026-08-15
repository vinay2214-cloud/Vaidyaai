import { useEffect, useRef, useState } from "react";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { getFirestoreDb } from "../lib/firebase";
import { useClinicStore } from "../store/clinicStore";
import { BACKEND_URL } from "@/lib/constants";

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

export function useAgentLogs(filterAgent?: string | null) {
  const clinicId = useClinicStore((state) => state.clinicId);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting");
  const seenIds = useRef<Set<string>>(new Set());

  // Real-time transport: SSE stream from the backend event bus, with Firestore
  // onSnapshot as a fallback for environments without a live stream.
  useEffect(() => {
    if (!clinicId) {
      setLoading(false);
      setStreamStatus("disconnected");
      return;
    }

    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      setStreamStatus("connecting");
      try {
        es = new EventSource(`${BACKEND_URL}/api/v1/stream/events`);
      } catch (e) {
        setStreamStatus("disconnected");
        return;
      }

      es.onopen = () => {
        if (!cancelled) setStreamStatus("connected");
      };

      es.addEventListener("connected", () => {
        if (!cancelled) setStreamStatus("connected");
      });

      es.addEventListener("event", (evt) => {
        if (cancelled) return;
        try {
          const data = JSON.parse((evt as MessageEvent).data);
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
        } catch (e) {
          // ignore malformed events
        }
      });

      es.onerror = () => {
        if (cancelled) return;
        setStreamStatus("reconnecting");
        es?.close();
        es = null;
        // SSE spec auto-reconnects, but we schedule a manual retry as well.
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
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
