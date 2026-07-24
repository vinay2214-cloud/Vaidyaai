import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List
from database.firestore import get_firestore_client

logger = logging.getLogger("vaidyaai.utils.evidence_export")


def _export_clinic_evidence_sync(clinic_id: str) -> Dict[str, Any]:
    db = get_firestore_client()
    
    # 1. Fetch agent logs
    logs_docs = (
        db.collection("agent_logs")
        .where("clinic_id", "==", clinic_id)
        .order_by("created_at", direction="DESCENDING")
        .limit(1000)
        .stream()
    )
    
    logs = []
    agent_counts: Dict[str, int] = {}
    total_latency = 0
    
    for doc in logs_docs:
        d = doc.to_dict()
        d["id"] = doc.id
        if "created_at" in d and hasattr(d["created_at"], "isoformat"):
            d["created_at"] = d["created_at"].isoformat()
            
        agent = d.get("agent_name", "unknown")
        agent_counts[agent] = agent_counts.get(agent, 0) + 1
        total_latency += d.get("latency_ms", 0)
        logs.append(d)
        
    avg_latency = (total_latency / len(logs)) if logs else 0.0
    
    # 2. Build summary report
    evidence_package = {
        "clinic_id": clinic_id,
        "summary": {
            "total_decisions_logged": len(logs),
            "decisions_by_agent": agent_counts,
            "average_latency_ms": round(avg_latency, 2),
            "export_timestamp": datetime.now(timezone.utc).isoformat()
        },
        "agent_logs": logs
    }
    
    return evidence_package


async def export_clinic_evidence(clinic_id: str) -> Dict[str, Any]:
    """
    Exports complete agent decision evidence and statistics for XPRIZE judges.
    Executes synchronous Firestore streaming off the main thread.
    """
    return await asyncio.to_thread(_export_clinic_evidence_sync, clinic_id)
