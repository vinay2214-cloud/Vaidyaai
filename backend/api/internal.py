import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Header, HTTPException, status, Depends
from pydantic import BaseModel
from config import settings
from api.auth import verify_internal_request
from agents.appointment_flow import AppointmentFlowAgent
from agents.billing_pulse import BillingPulseAgent
from agents.retention_radar import RetentionRadarAgent
from agents.insight_engine import InsightEngineAgent

logger = logging.getLogger("vaidyaai.api.internal")
router = APIRouter(dependencies=[Depends(verify_internal_request)])

appointment_agent = AppointmentFlowAgent()
billing_agent = BillingPulseAgent()
retention_agent = RetentionRadarAgent()
insight_agent = InsightEngineAgent()


class TaskExecuteRequest(BaseModel):
    task_type: str
    appointment_id: str
    clinic_id: str
    patient_phone: Optional[str] = None
    slot_time_str: Optional[str] = None


class DailyPnLRequest(BaseModel):
    clinic_id: str


class DailyOutreachRequest(BaseModel):
    clinic_id: str


class WeeklyInsightRequest(BaseModel):
    clinic_id: str


@router.post("/tasks/execute", tags=["internal"])
async def execute_internal_task(
    req: TaskExecuteRequest,
    x_cloud_tasks_queue: Optional[str] = Header(None)
):
    """
    POST /internal/tasks/execute
    Invoked by GCP Cloud Tasks to deliver async T-2h reminders or T+24h wellness checks.
    """
    logger.info(f"Received Cloud Task execution request: type={req.task_type}, app_id={req.appointment_id}")

    try:
        if not req.patient_phone:
            logger.error(f"Cloud Task {req.task_type} rejected: patient_phone is required")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="patient_phone is required for messaging tasks"
            )

        if req.task_type == "t_minus_2h_reminder":
            result = await appointment_agent.send_t_minus_2h_reminder(
                appointment_id=req.appointment_id,
                clinic_id=req.clinic_id,
                patient_phone=req.patient_phone,
                slot_time_str=req.slot_time_str or "10:00 AM"
            )
            return {"status": "success", "result": result}

        elif req.task_type == "t_plus_24h_check":
            result = await appointment_agent.send_t_plus_24h_wellness_check(
                appointment_id=req.appointment_id,
                clinic_id=req.clinic_id,
                patient_phone=req.patient_phone
            )
            return {"status": "success", "result": result}

        else:
            logger.warning(f"Unknown task type: {req.task_type}")
            return {"status": "ignored", "reason": f"Unknown task_type {req.task_type}"}

    except Exception as e:
        logger.error(f"Error executing Cloud Task {req.task_type}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Task execution failed: {str(e)}"
        )


@router.post("/billing/send-daily-pnl", tags=["internal"])
async def send_daily_pnl(
    req: DailyPnLRequest,
    x_cloud_scheduler: Optional[str] = Header(None)
):
    logger.info(f"Executing daily P&L summary for clinic {req.clinic_id}")
    result = await billing_agent.send_daily_pnl(req.clinic_id)
    return result


@router.post("/retention/run-daily-outreach", tags=["internal"])
async def run_daily_retention_outreach(
    req: DailyOutreachRequest,
    x_cloud_scheduler: Optional[str] = Header(None)
):
    logger.info(f"Executing daily retention outreach scan for clinic {req.clinic_id}")
    result = await retention_agent.scan_and_run_daily_outreach(req.clinic_id)
    return result


@router.post("/insights/send-weekly-report", tags=["internal"])
async def send_weekly_insight_report(
    req: WeeklyInsightRequest,
    x_cloud_scheduler: Optional[str] = Header(None)
):
    """
    POST /internal/insights/send-weekly-report
    Invoked weekly on Sunday at 8:00 PM IST by Cloud Scheduler for Agent 6 (InsightEngine) executive briefing.
    """
    logger.info(f"Executing weekly executive insight report for clinic {req.clinic_id}")
    result = await insight_agent.generate_weekly_insight_report(req.clinic_id)
    return result
