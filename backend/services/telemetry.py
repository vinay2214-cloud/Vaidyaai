"""Canonical agent telemetry aggregation.

Single source of truth for latency / success metrics so every dashboard
(Analytics, Settings, Agent Health, Dashboard) reports the same numbers.

Definitions (explicit denominators):
  decision_count        = number of agent execution records
  successful_executions = records with success != False
  failed_executions     = records with success == False
  success_rate          = successful_executions / decision_count
  average_latency_ms    = sum(latency_ms) / count(records with latency_ms not None)
                          (mean over individual executions, not mean-of-means)
"""
from typing import List, Dict, Any, Optional


def aggregate_telemetry(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregate a list of agent execution records into canonical metrics."""
    decision_count = len(records)
    successful = [r for r in records if r.get("success") is not False]
    failed = [r for r in records if r.get("success") is False]
    latencies = [r.get("latency_ms") for r in records if r.get("latency_ms") is not None]

    avg_latency = round(sum(latencies) / len(latencies), 1) if latencies else 0
    success_rate = round(len(successful) / decision_count * 100, 1) if decision_count else 0.0

    return {
        "decision_count": decision_count,
        "successful_executions": len(successful),
        "failed_executions": len(failed),
        "success_rate": success_rate,
        "average_latency_ms": avg_latency,
    }
