import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List
from database.firestore import query_collection

logger = logging.getLogger("vaidyaai.utils.evidence_export")


async def export_clinic_evidence(clinic_id: str) -> Dict[str, Any]:
    """
    Exports complete agent decision evidence and statistics for XPRIZE judges.
    Uses the in-memory-compatible query_collection helper so it works in both
    live Firestore and development in-memory fallback modes.
    """
    raw_logs = await query_collection(
        "agent_logs",
        [("clinic_id", "==", clinic_id)],
        limit=1000,
    )

    logs = []
    agent_counts: Dict[str, int] = {}
    total_latency = 0

    for d in raw_logs:
        if "created_at" in d and hasattr(d["created_at"], "isoformat"):
            d["created_at"] = d["created_at"].isoformat()

        agent = d.get("agent_name", "unknown")
        agent_counts[agent] = agent_counts.get(agent, 0) + 1
        total_latency += d.get("latency_ms", 0)
        logs.append(d)

    logs.sort(
        key=lambda x: x.get("created_at", ""),
        reverse=True,
    )

    avg_latency = (total_latency / len(logs)) if logs else 0.0

    evidence_package = {
        "clinic_id": clinic_id,
        "summary": {
            "total_decisions_logged": len(logs),
            "decisions_by_agent": agent_counts,
            "average_latency_ms": round(avg_latency, 2),
            "export_timestamp": datetime.now(timezone.utc).isoformat(),
        },
        "agent_logs": logs,
    }

    return evidence_package


# Alias for backward/forward compatibility across API imports
generate_evidence_package = export_clinic_evidence
