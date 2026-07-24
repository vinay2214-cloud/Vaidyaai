import { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { firestore } from "../lib/firebase";
import { useClinicStore } from "../store/clinicStore";

export interface AgentLog {
  id: string;
  agent_name: string;
  decision_type: str;
  decision_made: str;
  clinic_id: string;
  input_summary?: string;
  output_summary?: string;
  model_used?: string;
  latency_ms?: number;
  patient_phone_masked?: string;
  success?: boolean;
  created_at?: any;
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

    let q = query(
      collection(firestore, "agent_logs"),
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
            created_at: d.created_at
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
