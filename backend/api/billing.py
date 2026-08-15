import csv
import io
import logging
from datetime import datetime, timezone, date, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import select

from api.auth import get_current_user, verify_clinic_access
from database.postgres import AsyncSessionFactory
from models.clinic import Clinic
from models.billing import Invoice, DailyPLSummary
from agents.billing_pulse import BillingPulseAgent
from services.pricing import calculate_consultation_fee
from database.firestore import get_document
from utils.date_utils import get_today_ist_date_str, parse_ist_date

logger = logging.getLogger("vaidyaai.api.billing")
router = APIRouter()

billing_agent = BillingPulseAgent()


class EstimateRequest(BaseModel):
    clinic_id: str
    consultation_type: str = Field(default="new", pattern="^(new|followup|procedure)$")
    medication_count: int = 0
    investigation_count: int = 0
    discount_paise: int = 0


@router.post("/billing/estimate", tags=["billing"])
async def get_billing_estimate(
    req: EstimateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Canonical consultation fee estimate. Uses the same pricing service as the
    invoice, so the estimate shown to the patient always matches the final invoice."""
    verify_clinic_access(req.clinic_id, current_user)
    clinic_doc = await get_document("clinics", req.clinic_id)
    fees = clinic_doc.get("consultation_fees", {}) if clinic_doc else {}
    return calculate_consultation_fee(
        consultation_type=req.consultation_type,
        clinic_fees=fees,
        medication_count=req.medication_count,
        investigation_count=req.investigation_count,
        discount_paise=req.discount_paise,
    )


def _utc_day_bounds(day_str: str) -> tuple[datetime, datetime]:
    start = parse_ist_date(day_str)
    return start, start + timedelta(days=1)


def _utc_month_bounds(month_str: str) -> tuple[datetime, datetime]:
    month_start_date = datetime.strptime(f"{month_str}-01", "%Y-%m-%d").date()
    start = datetime.combine(month_start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    next_month = (
        date(month_start_date.year + 1, 1, 1)
        if month_start_date.month == 12
        else date(month_start_date.year, month_start_date.month + 1, 1)
    )
    end = datetime.combine(next_month, datetime.min.time()).replace(tzinfo=timezone.utc)
    return start, end


# ─── Pydantic Request / Response Schemas ─────────────────────────────────────

class ConfirmPaymentRequest(BaseModel):
    clinic_id: str
    invoice_id: str
    payment_method: str = Field(default="cash", pattern="^(cash|card|upi|whatsapp|insurance|credit)$")
    razorpay_payment_id: Optional[str] = None
    notes: Optional[str] = None


class WhatsAppActionRequest(BaseModel):
    clinic_id: str
    invoice_id: str
    action: str = Field(default="send_link", pattern="^(send_link|resend_reminder|delivery_status)$")


class MarkCashRequest(BaseModel):
    clinic_id: str
    invoice_id: str


class WaiveInvoiceRequest(BaseModel):
    clinic_id: str
    invoice_id: str
    reason: Optional[str] = "Doctor fee waiver"


class CreateInvoiceRequest(BaseModel):
    clinic_id: str
    consultation_id: str
    patient_phone: str
    patient_id: Optional[str] = None
    consultation_type: str = Field(default="new", pattern="^(new|followup|procedure)$")
    custom_amount_paise: Optional[int] = None
    fee_breakdown: Optional[Dict[str, int]] = None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/billing/today", tags=["billing"])
async def get_today_billing_summary(
    clinic_id: str = Query(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    GET /api/v1/billing/today?clinic_id={id}
    Returns today's financial summary and invoice list for the clinic.
    Enforces strict tenant isolation.
    """
    verify_clinic_access(clinic_id, current_user)
    today_str = get_today_ist_date_str()
    start_of_day, end_of_day = _utc_day_bounds(today_str)

    async with AsyncSessionFactory() as db:
        res = await db.execute(select(Clinic).where(Clinic.firebase_clinic_id == clinic_id))
        clinic_obj = res.scalar_one_or_none()
        if not clinic_obj:
            return {"total_billed_rupees": 0, "total_collected_rupees": 0, "invoices": []}

        invoices_res = await db.execute(
            select(Invoice).where(
                Invoice.clinic_id == clinic_obj.id,
                Invoice.created_at >= start_of_day,
                Invoice.created_at < end_of_day,
            ).order_by(Invoice.created_at.desc())
        )
        invoices = invoices_res.scalars().all()

        total_billed = sum(i.amount_paise for i in invoices) / 100.0
        total_collected = sum(i.amount_paise for i in invoices if i.status == "paid") / 100.0
        upi_collected = sum(i.amount_paise for i in invoices if i.status == "paid" and i.payment_method == "upi") / 100.0
        cash_collected = sum(i.amount_paise for i in invoices if i.status == "paid" and i.payment_method == "cash") / 100.0
        pending_amount = sum(i.amount_paise for i in invoices if i.status == "pending") / 100.0

        inv_list = []
        for inv in invoices:
            inv_list.append({
                "invoice_id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "patient_phone_masked": inv.patient_phone_masked,
                "patient_id": inv.patient_id,
                "consultation_id": inv.consultation_firestore_id,
                "amount_rupees": inv.amount_paise / 100.0,
                "amount_paise": inv.amount_paise,
                "consultation_type": inv.consultation_type,
                "status": inv.status,
                "payment_method": inv.payment_method,
                "payment_link_url": inv.razorpay_payment_link_url,
                "created_at": inv.created_at.isoformat() if inv.created_at else None,
                "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
                "reminder_sent_at": inv.reminder_sent_at.isoformat() if inv.reminder_sent_at else None,
            })

        return {
            "date": today_str,
            "total_billed_rupees": total_billed,
            "total_collected_rupees": total_collected,
            "upi_collected_rupees": upi_collected,
            "cash_collected_rupees": cash_collected,
            "pending_rupees": pending_amount,
            "invoice_count": len(invoices),
            "invoices": inv_list
        }


@router.get("/billing/monthly", tags=["billing"])
async def get_monthly_billing_summary(
    clinic_id: str = Query(...),
    month: Optional[str] = Query(None, description="Format: YYYY-MM"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    GET /api/v1/billing/monthly?clinic_id={id}&month=YYYY-MM
    Returns monthly practice revenue summary.
    """
    verify_clinic_access(clinic_id, current_user)
    target_month = month or get_today_ist_date_str()[:7]
    start_of_month, end_of_month = _utc_month_bounds(target_month)

    async with AsyncSessionFactory() as db:
        res = await db.execute(select(Clinic).where(Clinic.firebase_clinic_id == clinic_id))
        clinic_obj = res.scalar_one_or_none()
        if not clinic_obj:
            return {"month": target_month, "total_revenue_rupees": 0, "daily_summaries": []}

        summaries_res = await db.execute(
            select(DailyPLSummary).where(
                DailyPLSummary.clinic_id == clinic_obj.id,
                DailyPLSummary.date >= start_of_month.date(),
                DailyPLSummary.date < end_of_month.date(),
            ).order_by(DailyPLSummary.date.asc())
        )
        daily_records = summaries_res.scalars().all()

        total_billed = sum(d.total_billed_paise for d in daily_records) / 100.0
        total_collected = sum(d.total_collected_paise for d in daily_records) / 100.0

        daily_list = [
            {
                "date": d.date.isoformat(),
                "patients_seen": d.patients_seen,
                "billed_rupees": d.total_billed_paise / 100.0,
                "collected_rupees": d.total_collected_paise / 100.0,
                "upi_rupees": d.upi_paise / 100.0,
                "cash_rupees": d.cash_paise / 100.0
            }
            for d in daily_records
        ]

        return {
            "month": target_month,
            "total_billed_rupees": total_billed,
            "total_collected_rupees": total_collected,
            "daily_summaries": daily_list
        }


@router.post("/billing/create-invoice", tags=["billing"])
async def create_invoice_endpoint(
    req: CreateInvoiceRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    POST /api/v1/billing/create-invoice
    Triggered when doctor approves consultation SOAP note.
    """
    verify_clinic_access(req.clinic_id, current_user)

    # Safety gate: verify that the consultation's prescription was safety-checked.
    # Two independent blocks:
    #  (a) If the consultation carries medications, they must have a passing or
    #      explicitly-overridden safety evaluation.
    #  (b) Even with no medications persisted on the consultation, a stored
    #      safety_evaluation that is unsafe-and-not-overridden means an unsafe
    #      prescription was checked and must block billing (prevents bypass via
    #      direct invoice creation without a persisted medication list).
    from database.firestore import get_document
    consultation = await get_document("consultations", req.consultation_id)
    if consultation:
        safety_eval = consultation.get("safety_evaluation")
        effective_meds = consultation.get("medications", [])

        if effective_meds and len(effective_meds) > 0 and not safety_eval:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot create invoice: prescription safety check has not been run."
            )
        if safety_eval and not safety_eval.get("is_safe") and not safety_eval.get("overridden"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot create invoice: prescription flagged as unsafe by safety check."
            )

    result = await billing_agent.on_consultation_close(
        consultation_id=req.consultation_id,
        clinic_id=req.clinic_id,
        patient_phone=req.patient_phone,
        consultation_type=req.consultation_type,
        custom_amount_paise=req.custom_amount_paise,
        fee_breakdown=req.fee_breakdown,
        patient_id=req.patient_id
    )

    # Emit INVOICE_GENERATED event AFTER database commit
    from event_bus import ClinicalEvent, create_event, get_event_bus
    bus = get_event_bus()
    await bus.emit(create_event(
        ClinicalEvent.INVOICE_GENERATED,
        clinic_id=req.clinic_id,
        consultation_id=req.consultation_id,
        doctor_id=current_user.get("uid"),
        trigger="api:create_invoice",
        payload={"invoice_number": result.get("invoice_number"), "amount_rupees": result.get("amount_rupees")}
    ))

    return result


@router.post("/billing/confirm-payment", tags=["billing"])
async def confirm_payment_endpoint(
    req: ConfirmPaymentRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    POST /api/v1/billing/confirm-payment
    Confirms payment for an invoice (Cash, Card, UPI, Insurance, Credit).
    """
    verify_clinic_access(req.clinic_id, current_user)
    result = await billing_agent.confirm_payment(
        invoice_id=req.invoice_id,
        clinic_id=req.clinic_id,
        payment_method=req.payment_method,
        razorpay_payment_id=req.razorpay_payment_id,
        notes=req.notes
    )

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    # Emit PAYMENT_COMPLETED event AFTER database commit
    from event_bus import ClinicalEvent, create_event, get_event_bus
    bus = get_event_bus()
    await bus.emit(create_event(
        ClinicalEvent.PAYMENT_COMPLETED,
        clinic_id=req.clinic_id,
        doctor_id=current_user.get("uid"),
        trigger="api:confirm_payment",
        payload={"payment_method": req.payment_method, "invoice_id": req.invoice_id}
    ))

    return result


@router.post("/billing/whatsapp-action", tags=["billing"])
async def whatsapp_action_endpoint(
    req: WhatsAppActionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    POST /api/v1/billing/whatsapp-action
    Handles WhatsApp payment link delivery, reminders, and delivery status checks.
    """
    verify_clinic_access(req.clinic_id, current_user)
    result = await billing_agent.handle_whatsapp_action(
        invoice_id=req.invoice_id,
        clinic_id=req.clinic_id,
        action=req.action
    )

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    return result


@router.post("/billing/mark-cash", tags=["billing"])
async def mark_invoice_cash(
    req: MarkCashRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    POST /api/v1/billing/mark-cash
    Marks an invoice as paid via Cash.
    """
    verify_clinic_access(req.clinic_id, current_user)
    result = await billing_agent.mark_as_cash(req.invoice_id, req.clinic_id)

    # Emit PAYMENT_COMPLETED event AFTER database commit
    from event_bus import ClinicalEvent, create_event, get_event_bus
    bus = get_event_bus()
    await bus.emit(create_event(
        ClinicalEvent.PAYMENT_COMPLETED,
        clinic_id=req.clinic_id,
        doctor_id=current_user.get("uid"),
        trigger="api:mark_cash",
        payload={"payment_method": "cash", "invoice_id": req.invoice_id}
    ))

    return result


@router.post("/billing/waive", tags=["billing"])
async def waive_invoice_endpoint(
    req: WaiveInvoiceRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    POST /api/v1/billing/waive
    Waives fee for a consultation invoice.
    """
    verify_clinic_access(req.clinic_id, current_user)
    return await billing_agent.waive_invoice(req.invoice_id, req.clinic_id, req.reason or "Doctor fee waiver")


@router.get("/billing/export-csv", tags=["billing"])
async def export_billing_csv(
    clinic_id: str = Query(...),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    GET /api/v1/billing/export-csv?clinic_id={id}
    Exports financial invoices as a CSV file for clinic accounting & tax compliance.
    """
    verify_clinic_access(clinic_id, current_user)

    async with AsyncSessionFactory() as db:
        res = await db.execute(select(Clinic).where(Clinic.firebase_clinic_id == clinic_id))
        clinic_obj = res.scalar_one_or_none()
        if not clinic_obj:
            raise HTTPException(status_code=404, detail="Clinic not found")

        query = select(Invoice).where(Invoice.clinic_id == clinic_obj.id)
        if start_date:
            start_of_range, _ = _utc_day_bounds(start_date)
            query = query.where(Invoice.created_at >= start_of_range)
        if end_date:
            _, end_of_range = _utc_day_bounds(end_date)
            query = query.where(Invoice.created_at < end_of_range)

        query = query.order_by(Invoice.created_at.desc())
        invoices_res = await db.execute(query)
        invoices = invoices_res.scalars().all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Invoice Number", "Date", "Patient Phone", "Consultation Type",
            "Amount (INR)", "Status", "Payment Method", "Razorpay Payment ID", "Waived Reason"
        ])

        for inv in invoices:
            writer.writerow([
                inv.invoice_number,
                inv.created_at.strftime("%Y-%m-%d %H:%M:%S") if inv.created_at else "",
                inv.patient_phone_masked,
                inv.consultation_type or "",
                f"{inv.amount_paise / 100.0:.2f}",
                inv.status,
                inv.payment_method or "",
                inv.razorpay_payment_id or "",
                inv.waived_reason or ""
            ])

        csv_content = output.getvalue()

    filename = f"invoices_{clinic_id}_{get_today_ist_date_str()}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
