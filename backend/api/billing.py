import csv
import io
import logging
from datetime import datetime, timezone, date
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import select, func

from api.auth import get_current_user, verify_clinic_access
from database.postgres import AsyncSessionFactory
from models.clinic import Clinic
from models.billing import Invoice, DailyPLSummary
from agents.billing_pulse import BillingPulseAgent
from utils.date_utils import get_today_ist_date_str

logger = logging.getLogger("vaidyaai.api.billing")
router = APIRouter()

billing_agent = BillingPulseAgent()


# ─── Pydantic Request / Response Schemas ─────────────────────────────────────

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

    async with AsyncSessionFactory() as db:
        res = await db.execute(select(Clinic).where(Clinic.firebase_clinic_id == clinic_id))
        clinic_obj = res.scalar_one_or_none()
        if not clinic_obj:
            return {"total_billed_rupees": 0, "total_collected_rupees": 0, "invoices": []}

        invoices_res = await db.execute(
            select(Invoice).where(
                Invoice.clinic_id == clinic_obj.id,
                func.to_char(Invoice.created_at, 'YYYY-MM-DD') == today_str
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
                "amount_rupees": inv.amount_paise / 100.0,
                "consultation_type": inv.consultation_type,
                "status": inv.status,
                "payment_method": inv.payment_method,
                "payment_link_url": inv.razorpay_payment_link_url,
                "created_at": inv.created_at.isoformat() if inv.created_at else None,
                "paid_at": inv.paid_at.isoformat() if inv.paid_at else None
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

    async with AsyncSessionFactory() as db:
        res = await db.execute(select(Clinic).where(Clinic.firebase_clinic_id == clinic_id))
        clinic_obj = res.scalar_one_or_none()
        if not clinic_obj:
            return {"month": target_month, "total_revenue_rupees": 0, "daily_summaries": []}

        summaries_res = await db.execute(
            select(DailyPLSummary).where(
                DailyPLSummary.clinic_id == clinic_obj.id,
                func.to_char(DailyPLSummary.date, 'YYYY-MM') == target_month
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
    result = await billing_agent.on_consultation_close(
        consultation_id=req.consultation_id,
        clinic_id=req.clinic_id,
        patient_phone=req.patient_phone,
        consultation_type=req.consultation_type,
        custom_amount_paise=req.custom_amount_paise,
        fee_breakdown=req.fee_breakdown
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
            query = query.where(func.to_char(Invoice.created_at, 'YYYY-MM-DD') >= start_date)
        if end_date:
            query = query.where(func.to_char(Invoice.created_at, 'YYYY-MM-DD') <= end_date)

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
