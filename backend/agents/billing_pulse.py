import logging
from datetime import datetime, timezone, date
from typing import Optional, Dict, Any, List
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from agents.base_agent import BaseAgent
from services.razorpay_svc import RazorpayService
from services.whatsapp import WhatsAppService
from database.postgres import AsyncSessionFactory
from database.firestore import get_document
from models.clinic import Clinic
from models.billing import Invoice, DailyPLSummary
from tasks.cloud_tasks import schedule_billing_followup, cancel_task
from utils.phone_utils import mask_phone, normalize_phone
from utils.date_utils import get_current_ist_datetime, get_today_ist_date_str, format_display_date

logger = logging.getLogger("vaidyaai.agents.billing_pulse")


class BillingPulseAgent(BaseAgent):
    """
    Agent 3: BillingPulse
    Autonomous clinic billing, sequential invoice generation, Razorpay UPI link creation,
    WhatsApp invoice delivery, payment tracking, daily P&L aggregation, and financial persistence.
    """

    def __init__(self):
        super().__init__("billing_pulse")
        self.razorpay = RazorpayService()
        self.whatsapp = WhatsAppService()

    async def _generate_invoice_number(self, db: AsyncSession) -> str:
        """Generates sequential VDY-YYYYMMDD-XXXX invoice number."""
        today_str = get_today_ist_date_str().replace("-", "")
        today_d = date.today()
        start_of_today = datetime.combine(today_d, datetime.min.time()).replace(tzinfo=timezone.utc)
        
        query = select(func.count(Invoice.id)).where(Invoice.created_at >= start_of_today)
        res = await db.execute(query)
        count = res.scalar() or 0
        seq = count + 1001
        return f"VDY-{today_str}-{seq}"

    async def on_consultation_close(
        self,
        consultation_id: str,
        clinic_id: str,
        patient_phone: str,
        consultation_type: str = "new",
        custom_amount_paise: Optional[int] = None,
        fee_breakdown: Optional[Dict[str, int]] = None
    ) -> Dict[str, Any]:
        """
        Triggered when doctor approves SOAP note.
        Calculates fee, creates invoice in PostgreSQL, creates Razorpay payment link,
        sends WhatsApp invoice message to patient, and schedules T+24h payment reminder task.
        """
        normalized_phone = normalize_phone(patient_phone)
        masked_phone = mask_phone(normalized_phone)

        # 1. Determine consultation fee
        amount_paise = custom_amount_paise
        if amount_paise is None:
            clinic_doc = await get_document("clinics", clinic_id)
            fees = clinic_doc.get("consultation_fees", {}) if clinic_doc else {}
            if consultation_type == "followup":
                amount_paise = fees.get("followup_paise", 15000)
            elif consultation_type == "procedure":
                amount_paise = fees.get("procedure_paise", 50000)
            else:
                amount_paise = fees.get("new_patient_paise", 30000)

        # Calculate breakdown totals if provided (lab, imaging, medicines, procedure, discount, tax)
        if fee_breakdown:
            base = fee_breakdown.get("consultation", amount_paise)
            lab = fee_breakdown.get("lab", 0)
            imaging = fee_breakdown.get("imaging", 0)
            procedure = fee_breakdown.get("procedure", 0)
            medicine = fee_breakdown.get("medicine", 0)
            tax = fee_breakdown.get("tax", 0)
            discount = fee_breakdown.get("discount", 0)
            amount_paise = max(0, base + lab + imaging + procedure + medicine + tax - discount)

        async with AsyncSessionFactory() as db:
            # Look up PostgreSQL clinic record (auto-create if missing)
            res = await db.execute(select(Clinic).where(Clinic.firebase_clinic_id == clinic_id))
            clinic_obj = res.scalar_one_or_none()
            if not clinic_obj:
                clinic_obj = Clinic(
                    firebase_clinic_id=clinic_id,
                    name="VaidyaAI Test Clinic",
                    doctor_name="Dr. Vinay Sharma",
                    phone="+919876543210",
                    whatsapp_phone_id="123456789"
                )
                db.add(clinic_obj)
                await db.commit()
                await db.refresh(clinic_obj)
            pg_clinic_id = clinic_obj.id

            # Generate sequential invoice number
            invoice_num = await self._generate_invoice_number(db)

            # 2. Create Razorpay Payment Link
            amount_rupees = amount_paise / 100.0
            description = f"Medical Consultation Fee — {invoice_num}"
            link_res = await self.razorpay.create_payment_link(
                amount_paise=amount_paise,
                description=description,
                customer_phone=normalized_phone,
                invoice_number=invoice_num,
                consultation_id=consultation_id
            )

            payment_link_url = link_res.get("payment_link_url") or link_res.get("short_url")
            payment_link_id = link_res.get("payment_link_id")

            # 3. Insert Invoice record into PostgreSQL
            invoice = Invoice(
                invoice_number=invoice_num,
                clinic_id=pg_clinic_id,
                patient_phone_masked=masked_phone,
                consultation_firestore_id=consultation_id,
                amount_paise=amount_paise,
                consultation_type=consultation_type,
                status="pending",
                razorpay_payment_link_id=payment_link_id,
                razorpay_payment_link_url=payment_link_url,
                created_at=datetime.now(timezone.utc)
            )
            db.add(invoice)
            await db.commit()
            await db.refresh(invoice)

            # 4. Schedule Cloud Task for T+24h billing follow-up
            followup_task_name = await schedule_billing_followup(
                invoice_id=str(invoice.id),
                patient_phone=normalized_phone,
                clinic_id=clinic_id,
                amount_paise=amount_paise,
                language="te"
            )
            if followup_task_name:
                invoice.reminder_sent_at = datetime.now(timezone.utc)
                await db.commit()

            # 5. Send Invoice WhatsApp message to patient
            clinic_doc = await get_document("clinics", clinic_id)
            clinic_name = clinic_doc.get("name", "VaidyaAI Clinic") if clinic_doc else "Clinic"
            doctor_name = clinic_doc.get("doctor_name", "Doctor") if clinic_doc else "Doctor"
            phone_id = clinic_doc.get("whatsapp_phone_id") if clinic_doc else None
            access_token = clinic_doc.get("whatsapp_access_token") if clinic_doc else None

            invoice_msg = (
                f"🧾 Invoice #{invoice_num}\n"
                f"{clinic_name} — Dr. {doctor_name}\n\n"
                f"Consultation: {consultation_type.capitalize()}\n"
                f"Amount: ₹{amount_rupees:.2f}\n\n"
                f"Pay securely via UPI / Razorpay:\n"
                f"{payment_link_url}\n\n"
                f"Link valid for 48 hours."
            )

            await self.whatsapp.send_text(
                to=normalized_phone,
                message=invoice_msg,
                phone_id=phone_id,
                access_token=access_token
            )

            await self.logger.log_decision(
                decision_type="invoice_created",
                decision_made=f"Created invoice #{invoice_num} for ₹{amount_rupees:.2f} & sent UPI payment link",
                clinic_id=clinic_id,
                patient_phone_masked=masked_phone,
                consultation_id=consultation_id
            )

            return {
                "invoice_id": str(invoice.id),
                "invoice_number": invoice_num,
                "amount_paise": amount_paise,
                "amount_rupees": amount_rupees,
                "payment_link_url": payment_link_url,
                "status": "pending"
            }

    async def on_payment_confirmed(
        self,
        razorpay_payment_link_id: str,
        amount_paise: int,
        razorpay_payment_id: str,
        payment_method: str = "upi"
    ) -> Dict[str, Any]:
        """Triggered via Razorpay webhook when payment is successfully captured."""
        async with AsyncSessionFactory() as db:
            res = await db.execute(
                select(Invoice).where(Invoice.razorpay_payment_link_id == razorpay_payment_link_id)
            )
            invoice = res.scalar_one_or_none()
            if not invoice:
                logger.warning(f"Payment confirmed for unknown payment_link_id '{razorpay_payment_link_id}'")
                return {"status": "not_found"}

            # Idempotency guard: Razorpay may deliver the same webhook more than
            # once (documented retry behaviour) and a replayed signed payload must
            # not double-count collected revenue in the daily P&L summary.
            if invoice.status == "paid":
                logger.info(
                    f"Invoice {invoice.invoice_number} already marked paid; "
                    f"ignoring duplicate payment webhook for '{razorpay_payment_link_id}'"
                )
                return {
                    "status": "already_paid",
                    "invoice_number": invoice.invoice_number,
                    "amount_paise": amount_paise
                }

            now = datetime.now(timezone.utc)
            invoice.status = "paid"
            invoice.payment_method = payment_method
            invoice.razorpay_payment_id = razorpay_payment_id
            invoice.paid_at = now
            await db.commit()

            # Update daily P&L summary for today
            today_d = date.today()
            await self._update_daily_pl(db, invoice.clinic_id, today_d, amount_paise, payment_method)

            await self.logger.log_decision(
                decision_type="payment_confirmed",
                decision_made=f"Payment of ₹{amount_paise/100:.2f} confirmed for invoice {invoice.invoice_number} via {payment_method.upper()}",
                clinic_id=str(invoice.clinic_id),
                patient_phone_masked=invoice.patient_phone_masked
            )

            return {
                "status": "paid",
                "invoice_number": invoice.invoice_number,
                "amount_paise": amount_paise
            }

    async def mark_as_cash(self, invoice_id: str, clinic_id: str) -> Dict[str, Any]:
        """Allows doctor to manually mark an invoice as paid via Cash in dashboard."""
        async with AsyncSessionFactory() as db:
            res = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
            invoice = res.scalar_one_or_none()
            if not invoice:
                return {"error": "Invoice not found"}

            now = datetime.now(timezone.utc)
            invoice.status = "paid"
            invoice.payment_method = "cash"
            invoice.paid_at = now
            await db.commit()

            today_d = date.today()
            await self._update_daily_pl(db, invoice.clinic_id, today_d, invoice.amount_paise, "cash")

            await self.logger.log_decision(
                decision_type="cash_payment_logged",
                decision_made=f"Marked invoice {invoice.invoice_number} (₹{invoice.amount_paise/100:.2f}) as paid via CASH",
                clinic_id=clinic_id,
                patient_phone_masked=invoice.patient_phone_masked
            )

            return {"updated": True, "invoice_number": invoice.invoice_number, "status": "paid"}

    async def waive_invoice(self, invoice_id: str, clinic_id: str, reason: str = "Doctor waiver") -> Dict[str, Any]:
        """Allows doctor to waive fee for needy or staff patients."""
        async with AsyncSessionFactory() as db:
            res = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
            invoice = res.scalar_one_or_none()
            if not invoice:
                return {"error": "Invoice not found"}

            invoice.status = "waived"
            invoice.payment_method = "waived"
            invoice.waived_reason = reason
            await db.commit()

            await self.logger.log_decision(
                decision_type="invoice_waived",
                decision_made=f"Waived invoice {invoice.invoice_number} (Reason: {reason})",
                clinic_id=clinic_id,
                patient_phone_masked=invoice.patient_phone_masked
            )

            return {"updated": True, "invoice_number": invoice.invoice_number, "status": "waived"}

    async def _update_daily_pl(self, db: AsyncSession, clinic_id: Any, target_date: date, amount_paise: int, method: str):
        """Helper to upsert daily_pl_summary table records."""
        res = await db.execute(
            select(DailyPLSummary).where(
                DailyPLSummary.clinic_id == clinic_id,
                DailyPLSummary.date == target_date
            )
        )
        pl = res.scalar_one_or_none()
        if not pl:
            pl = DailyPLSummary(
                clinic_id=clinic_id,
                date=target_date,
                patients_seen=1,
                total_billed_paise=amount_paise,
                total_collected_paise=amount_paise,
                upi_paise=0,
                cash_paise=0,
                card_paise=0,
                invoice_count=1
            )
            db.add(pl)
        else:
            pl.total_collected_paise += amount_paise
            pl.invoice_count += 1

        if method == "upi":
            pl.upi_paise += amount_paise
        elif method == "cash":
            pl.cash_paise += amount_paise
        elif method == "card":
            pl.card_paise += amount_paise

        await db.commit()

    async def send_daily_pnl(self, clinic_id: str) -> Dict[str, Any]:
        """
        Triggered at 9:00 PM IST daily via Cloud Scheduler.
        Aggregates today's billed vs collected revenue and sends summary to doctor's WhatsApp.
        """
        today_d = date.today()
        today_str = get_today_ist_date_str()

        async with AsyncSessionFactory() as db:
            # Query invoices created today
            res = await db.execute(
                select(Clinic).where(Clinic.firebase_clinic_id == clinic_id)
            )
            clinic_obj = res.scalar_one_or_none()
            if not clinic_obj:
                return {"error": "Clinic not found"}

            today_d = date.today()
            start_of_today = datetime.combine(today_d, datetime.min.time()).replace(tzinfo=timezone.utc)
            invoices_res = await db.execute(
                select(Invoice).where(
                    Invoice.clinic_id == clinic_obj.id,
                    Invoice.created_at >= start_of_today
                )
            )
            invoices = invoices_res.scalars().all()

            patients_seen = len(invoices)
            total_billed = sum(i.amount_paise for i in invoices)
            collected = sum(i.amount_paise for i in invoices if i.status == "paid")
            upi_amt = sum(i.amount_paise for i in invoices if i.status == "paid" and i.payment_method == "upi")
            cash_amt = sum(i.amount_paise for i in invoices if i.status == "paid" and i.payment_method == "cash")
            pending = sum(i.amount_paise for i in invoices if i.status == "pending")

            clinic_doc = await get_document("clinics", clinic_id)
            doctor_name = clinic_doc.get("doctor_name", clinic_obj.doctor_name) if clinic_doc else clinic_obj.doctor_name
            clinic_name = clinic_doc.get("name", clinic_obj.name) if clinic_doc else clinic_obj.name
            doctor_phone = clinic_obj.phone
            phone_id = clinic_doc.get("whatsapp_phone_id") if clinic_doc else None
            access_token = clinic_doc.get("whatsapp_access_token") if clinic_doc else None

            pnl_text = (
                f"📊 Today's Summary — Dr. {doctor_name}'s Clinic\n"
                f"Date: {format_display_date(datetime.now(timezone.utc))}\n\n"
                f"Patients seen: {patients_seen}\n"
                f"Billed: ₹{total_billed/100:.2f}\n"
                f"Collected: ₹{collected/100:.2f}\n"
                f"  ├ UPI: ₹{upi_amt/100:.2f}\n"
                f"  └ Cash: ₹{cash_amt/100:.2f}\n"
                f"Pending: ₹{pending/100:.2f}\n\n"
                f"VaidyaAI BillingPulse • {clinic_name}"
            )

            await self.whatsapp.send_text(
                to=doctor_phone,
                message=pnl_text,
                phone_id=phone_id,
                access_token=access_token
            )

            await self.logger.log_decision(
                decision_type="daily_pnl_sent",
                decision_made=f"Sent daily P&L to Dr. {doctor_name}: Billed ₹{total_billed/100:.2f}, Collected ₹{collected/100:.2f}",
                clinic_id=clinic_id
            )

            return {
                "patients_seen": patients_seen,
                "total_billed_paise": total_billed,
                "collected_paise": collected,
                "pending_paise": pending,
                "sent_to_phone": doctor_phone
            }
