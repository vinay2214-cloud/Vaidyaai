import { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { getFirestoreDb } from "../lib/firebase";
import { useClinicStore } from "../store/clinicStore";

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

export function useAgentLogs(filterAgent?: string | null) {
  const clinicId = useClinicStore((state) => state.clinicId);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicId) {
      setLoading(false);
      return;
    }

    const db = getFirestoreDb();
    if (!db) {
      console.warn("[useAgentLogs] Firestore not initialized.");
      setLoading(false);
      return;
    }

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
      setLogs(docs);
      setLoading(false);
    }, (error) => {
      console.warn("Agent logs onSnapshot error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [clinicId, filterAgent]);

  return { logs, loading };
}

export interface AgentHealthItem {
  id: string;
  name: string;
  role: string;
  model: string;
  status: "Healthy" | "Running" | "Idle" | "Completed" | "Failed";
  tasks_today: number;
  avg_latency_ms: number;
  success_rate_pct: number;
  last_run_at: string | null;
  failures_today: number;
  last_decision: string | null;
}

export interface AgentHealthResponse {
  clinic_id: string;
  platform: {
    active_agents: number;
    total_agents: number;
    total_tasks_today: number;
    total_failures_today: number;
    avg_latency_ms: number;
    health_pct: number;
  };
  agents: AgentHealthItem[];
}

export function useAgentHealth() {
  const clinicId = useClinicStore((state) => state.clinicId);
  const [healthData, setHealthData] = useState<AgentHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchHealth = async () => {
      try {
        const { default: api } = await import("@/lib/api");
        const res = await api.get(`/agents/health?clinic_id=${clinicId}`);
        if (isMounted) {
          setHealthData(res.data);
        }
      } catch (e) {
        console.warn("Failed to fetch agent health:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [clinicId]);

  return { healthData, loading };
}
