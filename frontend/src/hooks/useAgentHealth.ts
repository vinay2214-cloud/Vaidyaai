import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../lib/api';
import { useClinicStore } from '../store/clinicStore';

export interface AgentHealthData {
  id: string;
  name: string;
  role: string;
  model: string;
  status: string;
  tasks_today: number;
  avg_latency_ms: number;
  success_rate_pct: number;
  last_run_at: string | null;
  failures_today: number;
  last_decision: string | null;
}

export interface PlatformHealth {
  active_agents: number;
  total_agents: number;
  total_tasks_today: number;
  total_failures_today: number;
  avg_latency_ms: number;
  health_pct: number;
}

export function useAgentHealth() {
  const clinicId = useClinicStore((state) => state.clinicId);
  
  const [agents, setAgents] = useState<AgentHealthData[]>([]);
  const [platform, setPlatform] = useState<PlatformHealth | null>(null);
  const [loading, setLoading] = useState(true);
  
  const refresh = useCallback(async () => {
    if (!clinicId) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/agents/health?clinic_id=${clinicId}`);
      if (response.data) {
        setAgents(response.data.agents || []);
        setPlatform(response.data.platform || null);
      }
    } catch (error) {
      console.error('Failed to fetch agent health:', error);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);
  
  useEffect(() => {
    refresh();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      refresh();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [refresh]);
  
  return { agents, platform, loading, refresh };
}
