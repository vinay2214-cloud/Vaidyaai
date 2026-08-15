"""Real-time event stream (SSE) for live agent observability.

The frontend connects to GET /api/v1/stream/events and receives every event
emitted on the in-process event bus as Server-Sent Events. This provides:
  - live ordering (SSE preserves order)
  - automatic reconnect (SSE spec)
  - a heartbeat to keep the connection alive and detect drops
  - connection status via the initial `connected` event
"""
import asyncio
import json
import logging
from typing import Dict, Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from api.auth import get_current_user
from event_bus import get_event_bus

logger = logging.getLogger("vaidyaai.api.stream")
router = APIRouter()

HEARTBEAT_INTERVAL = 15.0
MAX_QUEUE = 200


@router.get("/stream/events", tags=["stream"])
async def stream_events(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """SSE stream of live clinical events for the authenticated clinic."""
    bus = get_event_bus()
    queue: asyncio.Queue = asyncio.Queue(maxsize=MAX_QUEUE)
    bus.subscribe_stream(queue)

    async def event_generator():
        try:
            # Initial connection event so the client can show "connected".
            yield "event: connected\ndata: {}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_INTERVAL)
                    payload = {
                        "event_id": event.get("event_id"),
                        "event_type": event.get("event_type"),
                        "clinic_id": event.get("clinic_id"),
                        "patient_id": event.get("patient_id"),
                        "consultation_id": event.get("consultation_id"),
                        "correlation_id": event.get("correlation_id"),
                        "created_at": event.get("created_at"),
                        "payload": event.get("payload"),
                    }
                    yield f"event: event\ndata: {json.dumps(payload, default=str)}\n\n"
                except asyncio.TimeoutError:
                    # Heartbeat keeps the connection alive.
                    yield ": keepalive\n\n"
        finally:
            bus.unsubscribe_stream(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
