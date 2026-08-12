import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from agents.base_agent import BaseAgent
from services.whatsapp import WhatsAppService
from prompts.appointment_intent import build_appointment_intent_prompt
from prompts.enquiry_templates import (
    CONFIRMATION_TEMPLATES,
    REMINDER_TEMPLATES,
    WELLNESS_TEMPLATES,
    EMERGENCY_TEMPLATES,
    CANCEL_TEMPLATES,
    ENQUIRY_TEMPLATES,
    OTHER_TEMPLATES,
    CONSENT_TEMPLATES
)
from database.firestore import (
    get_document,
    set_document,
    update_document,
    get_patient_by_phone,
    get_appointments_today,
    get_available_slots
)
from tasks.cloud_tasks import (
    schedule_appointment_reminder,
    schedule_wellness_check,
    cancel_task
)
from utils.phone_utils import mask_phone, normalize_phone
from utils.phi_anonymiser import anonymise_for_llm
from utils.date_utils import get_current_ist_datetime, get_today_ist_date_str, format_display_time, format_display_date


class AppointmentFlowAgent(BaseAgent):
    """
    Agent 1: AppointmentFlow
    Autonomous WhatsApp appointment booking, rescheduling, cancellation, 
    emergency redirection, and reminder scheduling for solo clinic patients.
    """

    def __init__(self):
        super().__init__("appointment_flow")
        self.whatsapp = WhatsAppService()

    async def handle_incoming_message(
        self,
        from_phone: str,
        message: str,
        clinic_id: str,
        phone_id: Optional[str] = None,
        access_token: Optional[str] = None,
        list_reply_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Main entry point for incoming WhatsApp messages."""
        normalized_phone = normalize_phone(from_phone)
        masked_phone = mask_phone(normalized_phone)

        # 1. Check patient record & consent status
        patient = await get_patient_by_phone(normalized_phone, clinic_id)
        if patient and patient.get("opted_out"):
            self.log.info(f"Patient {masked_phone} has opted out. Skipping agent action.")
            return {"status": "opted_out"}

        # 2. Check pending bookings state (if patient is selecting an offered slot)
        pending_booking = await get_document("pending_bookings", normalized_phone)
        if pending_booking and (list_reply_id or message.strip().isdigit()):
            selected_id = list_reply_id or message.strip()
            return await self._handle_slot_selection(
                from_phone=normalized_phone,
                selected_slot_id=selected_id,
                pending_booking=pending_booking,
                clinic_id=clinic_id,
                phone_id=phone_id,
                access_token=access_token
            )

        # 3. Call Gemini 2.5 Flash to detect intent and language
        # C-7: anonymise the raw patient message before it leaves for the LLM.
        from config import settings
        prompt = build_appointment_intent_prompt(anonymise_for_llm(message))
        intent_data, latency_ms = await self._timed_gemini_json_call(
            task="intent_detection",
            prompt=prompt,
            model=settings.GEMINI_FAST_MODEL
        )

        intent = intent_data.get("intent", "OTHER")
        language = intent_data.get("language", "te")
        urgency = intent_data.get("urgency", "ROUTINE")
        if language not in ["te", "hi", "en", "ta"]:
            language = "te"

        await self.logger.log_decision(
            decision_type="intent_detected",
            decision_made=f"Detected intent '{intent}' in '{language}' (urgency={urgency}) via {settings.GEMINI_FAST_MODEL}",
            clinic_id=clinic_id,
            input_summary=message[:100],
            output_summary=str(intent_data),
            model_used=settings.GEMINI_FAST_MODEL,
            latency_ms=latency_ms,
            patient_phone_masked=masked_phone
        )

        # 4. Route based on urgency or intent
        if urgency == "EMERGENCY" or intent == "EMERGENCY":
            return await self._handle_emergency(normalized_phone, clinic_id, phone_id, access_token, language)

        if intent == "BOOK":
            return await self._handle_booking(normalized_phone, intent_data, clinic_id, phone_id, access_token, language)
        elif intent == "CANCEL":
            return await self._handle_cancellation(normalized_phone, clinic_id, phone_id, access_token, language)
        elif intent == "RESCHEDULE":
            return await self._handle_reschedule(normalized_phone, clinic_id, phone_id, access_token, language)
        elif intent == "ENQUIRY":
            return await self._handle_enquiry(normalized_phone, clinic_id, phone_id, access_token, language)
        else:
            return await self._handle_other(normalized_phone, clinic_id, phone_id, access_token, language)

    # Backward compatibility alias
    async def process_incoming_whatsapp(
        self,
        phone_number: str,
        message_text: str,
        clinic_id: str
    ) -> Dict[str, Any]:
        return await self.handle_incoming_message(
            from_phone=phone_number,
            message=message_text,
            clinic_id=clinic_id
        )

    async def send_t_minus_2h_reminder(
        self,
        appointment_id: str,
        clinic_id: str,
        patient_phone: str,
        slot_time_str: str = "10:00 AM"
    ) -> Dict[str, Any]:
        """Send a T-2h appointment reminder via WhatsApp. Invoked by Cloud Tasks."""
        normalized_phone = normalize_phone(patient_phone)
        masked_phone = mask_phone(normalized_phone)

        appointment = await get_document("appointments", appointment_id)
        queue_position = (appointment or {}).get("queue_number", 1)
        language = "te"

        clinic = await get_document("clinics", clinic_id) or {}
        doctor_name = clinic.get("doctor_name", "Doctor")
        phone_id = clinic.get("whatsapp_phone_id")
        access_token = clinic.get("whatsapp_access_token")

        reminder_text = REMINDER_TEMPLATES.get(language, REMINDER_TEMPLATES["en"]).format(
            time=slot_time_str,
            queue_position=queue_position,
            doctor_name=doctor_name
        )

        await self.whatsapp.send_text(
            to=normalized_phone,
            message=reminder_text,
            phone_id=phone_id,
            access_token=access_token
        )

        await self.logger.log_decision(
            decision_type="t_minus_2h_reminder_sent",
            decision_made=f"Sent T-2h reminder for appointment {appointment_id} to {masked_phone} at {slot_time_str}",
            clinic_id=clinic_id,
            patient_phone_masked=masked_phone,
            appointment_id=appointment_id
        )
        return {"status": "reminder_sent", "appointment_id": appointment_id}

    async def send_t_plus_24h_wellness_check(
        self,
        appointment_id: str,
        clinic_id: str,
        patient_phone: str
    ) -> Dict[str, Any]:
        """Send a T+24h wellness follow-up via WhatsApp. Invoked by Cloud Tasks."""
        normalized_phone = normalize_phone(patient_phone)
        masked_phone = mask_phone(normalized_phone)
        language = "te"

        clinic = await get_document("clinics", clinic_id) or {}
        doctor_name = clinic.get("doctor_name", "Doctor")
        phone_id = clinic.get("whatsapp_phone_id")
        access_token = clinic.get("whatsapp_access_token")

        wellness_text = WELLNESS_TEMPLATES.get(language, WELLNESS_TEMPLATES["en"]).format(
            doctor_name=doctor_name
        )

        await self.whatsapp.send_text(
            to=normalized_phone,
            message=wellness_text,
            phone_id=phone_id,
            access_token=access_token
        )

        await self.logger.log_decision(
            decision_type="t_plus_24h_wellness_check_sent",
            decision_made=f"Sent T+24h wellness check for appointment {appointment_id} to {masked_phone}",
            clinic_id=clinic_id,
            patient_phone_masked=masked_phone,
            appointment_id=appointment_id
        )
        return {"status": "wellness_check_sent", "appointment_id": appointment_id}

    async def _handle_booking(
        self,
        from_phone: str,
        intent_data: Dict[str, Any],
        clinic_id: str,
        phone_id: Optional[str],
        access_token: Optional[str],
        language: str
    ) -> Dict[str, Any]:
        today_date = get_today_ist_date_str()
        slots = await get_available_slots(clinic_id, today_date)

        if not slots:
            no_slots_text = {
                "te": "క్షమించండి, ఈరోజు క్లినిక్‌లో స్లాట్‌లు అందుబాటులో లేవు. రేపు మళ్లీ ప్రయత్నించండి.",
                "hi": "क्षमा करें, आज क्लिनिक में कोई स्लॉट उपलब्ध नहीं है। कृपया कल पुनः प्रयास करें।",
                "en": "Sorry, no slots available today. Please try again tomorrow.",
                "ta": "மன்னிக்கவும், இன்று நேரங்கள் எதுவும் கிடைக்கவில்லை. நாளை மீண்டும் முயற்சிக்கவும்."
            }
            await self.whatsapp.send_text(
                to=from_phone,
                message=no_slots_text.get(language, no_slots_text["en"]),
                phone_id=phone_id,
                access_token=access_token
            )
            return {"status": "no_slots"}

        available_slots = slots[:6]
        
        rows = []
        for idx, slot in enumerate(available_slots, 1):
            rows.append({
                "id": f"slot_{idx}",
                "title": slot["slot_time_str"],
                "description": f"Appointment Slot #{idx}"
            })
            
        sections = [{"title": "Available Slots", "rows": rows}]

        body_text = {
            "te": "దయచేసి మీ అపాయింట్‌మెంట్ సమయాన్ని ఎంచుకోండి:",
            "hi": "कृपया अपना अपॉइंटमेंट समय चुनें:",
            "en": "Please select your preferred appointment slot:",
            "ta": "உங்கள் சந்திப்பு நேரத்தைத் தேர்ந்தெடுக்கவும்:"
        }.get(language, "Please select an appointment slot:")

        button_label = {
            "te": "స్లాట్ ఎంచుకోండి",
            "hi": "समय चुनें",
            "en": "Select Slot",
            "ta": "நேரம் தேர்வு"
        }.get(language, "Select Slot")

        await self.whatsapp.send_interactive_list(
            to=from_phone,
            body=body_text,
            button_label=button_label,
            sections=sections,
            phone_id=phone_id,
            access_token=access_token
        )

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=30)
        
        pending_doc = {
            "clinic_id": clinic_id,
            "available_slots": available_slots,
            "intent": intent_data,
            "language": language,
            "created_at": now,
            "expires_at": expires_at
        }
        await set_document("pending_bookings", from_phone, pending_doc)

        await self.logger.log_decision(
            decision_type="slots_offered",
            decision_made=f"Offered {len(available_slots)} slots to {mask_phone(from_phone)}",
            clinic_id=clinic_id,
            patient_phone_masked=mask_phone(from_phone)
        )
        return {"status": "slots_offered", "slots_count": len(available_slots)}

    async def _handle_slot_selection(
        self,
        from_phone: str,
        selected_slot_id: str,
        pending_booking: Dict[str, Any],
        clinic_id: str,
        phone_id: Optional[str],
        access_token: Optional[str]
    ) -> Dict[str, Any]:
        available_slots = pending_booking.get("available_slots", [])
        language = pending_booking.get("language", "te")

        slot_idx = 0
        if "slot_" in selected_slot_id:
            try:
                slot_idx = int(selected_slot_id.replace("slot_", "")) - 1
            except ValueError:
                slot_idx = 0
        elif selected_slot_id.isdigit():
            slot_idx = int(selected_slot_id) - 1

        if slot_idx < 0 or slot_idx >= len(available_slots):
            chosen_slot = available_slots[0] if available_slots else {"slot_time_str": "10:00 AM"}
        else:
            chosen_slot = available_slots[slot_idx]

        patient_id = await self._ensure_patient_exists(from_phone, clinic_id, language)

        clinic = await get_document("clinics", clinic_id)
        clinic_name = clinic.get("name", "VaidyaAI Clinic") if clinic else "Clinic"
        doctor_name = clinic.get("doctor_name", "Doctor") if clinic else "Doctor"

        today_str = get_today_ist_date_str()
        slot_time_str = chosen_slot.get("slot_time_str", "10:00 AM")
        
        existing = await get_appointments_today(clinic_id, today_str)
        queue_number = len(existing) + 1

        now_ist = get_current_ist_datetime()
        slot_datetime_utc = now_ist.replace(hour=10, minute=0, second=0, microsecond=0).astimezone(timezone.utc)

        now_utc = datetime.now(timezone.utc)
        appointment_data = {
            "clinic_id": clinic_id,
            "patient_id": patient_id,
            "patient_phone_masked": mask_phone(from_phone),
            "slot_time": slot_datetime_utc,
            "slot_date": today_str,
            "slot_time_str": slot_time_str,
            "duration_minutes": 15,
            "complaint_summary": pending_booking.get("intent", {}).get("complaint_summary") or "Consultation",
            "status": "booked",
            "consultation_type": "new",
            "booked_by": "whatsapp_agent",
            "queue_number": queue_number,
            "created_at": now_utc
        }

        app_id = f"app_{int(now_utc.timestamp())}"
        await set_document("appointments", app_id, appointment_data)

        reminder_task = await schedule_appointment_reminder(
            appointment_id=app_id,
            slot_time=slot_datetime_utc,
            patient_phone=from_phone,
            clinic_id=clinic_id,
            language=language
        )
        wellness_task = await schedule_wellness_check(
            appointment_id=app_id,
            slot_time=slot_datetime_utc,
            patient_phone=from_phone,
            clinic_id=clinic_id,
            language=language
        )

        if reminder_task or wellness_task:
            await update_document("appointments", app_id, {
                "reminder_task_name": reminder_task,
                "wellness_task_name": wellness_task
            })

        confirm_text = CONFIRMATION_TEMPLATES.get(language, CONFIRMATION_TEMPLATES["en"]).format(
            doctor_name=doctor_name,
            date=today_str,
            time=slot_time_str,
            queue_number=queue_number,
            clinic_name=clinic_name
        )
        await self.whatsapp.send_text(
            to=from_phone,
            message=confirm_text,
            phone_id=phone_id,
            access_token=access_token
        )

        await update_document("pending_bookings", from_phone, {"expires_at": now_utc})

        await self.logger.log_decision(
            decision_type="appointment_booked",
            decision_made=f"Booked slot '{slot_time_str}' (# {queue_number}) for {mask_phone(from_phone)}",
            clinic_id=clinic_id,
            patient_phone_masked=mask_phone(from_phone),
            appointment_id=app_id
        )
        return {"status": "appointment_booked", "appointment_id": app_id}

    async def _handle_cancellation(
        self,
        from_phone: str,
        clinic_id: str,
        phone_id: Optional[str],
        access_token: Optional[str],
        language: str
    ) -> Dict[str, Any]:
        today_str = get_today_ist_date_str()
        existing = await get_appointments_today(clinic_id, today_str)

        target_app = None
        for app in existing:
            if app.get("patient_phone_masked") == mask_phone(from_phone) and app.get("status") == "booked":
                target_app = app
                break

        clinic = await get_document("clinics", clinic_id)
        clinic_name = clinic.get("name", "VaidyaAI Clinic") if clinic else "Clinic"

        if target_app:
            app_id = target_app["appointment_id"]
            await update_document("appointments", app_id, {
                "status": "cancelled",
                "cancelled_at": datetime.now(timezone.utc),
                "cancel_reason": "Cancelled by patient via WhatsApp"
            })

            if target_app.get("reminder_task_name"):
                await cancel_task(target_app["reminder_task_name"])
            if target_app.get("wellness_task_name"):
                await cancel_task(target_app["wellness_task_name"])

            cancel_msg = CANCEL_TEMPLATES.get(language, CANCEL_TEMPLATES["en"]).format(
                clinic_name=clinic_name
            )
            await self.whatsapp.send_text(
                to=from_phone,
                message=cancel_msg,
                phone_id=phone_id,
                access_token=access_token
            )

            await self.logger.log_decision(
                decision_type="appointment_cancelled",
                decision_made=f"Cancelled appointment '{app_id}' for {mask_phone(from_phone)}",
                clinic_id=clinic_id,
                patient_phone_masked=mask_phone(from_phone),
                appointment_id=app_id
            )
            return {"status": "appointment_cancelled", "appointment_id": app_id}

        no_app_text = {
            "te": "మీ పేరుపై రద్దు చేయడానికి క్రియాశీల అపాయింట్‌మెంట్‌లు ఏవీ కనుగొనబడలేదు.",
            "hi": "आपके नाम पर कोई सक्रिय अपॉइंटमेंट नहीं मिला।",
            "en": "No active appointments found to cancel under your number.",
            "ta": "ரத்து செய்ய எந்த செயலில் உள்ள சந்திப்புகளும் காணப்படவில்லை."
        }.get(language, "No active appointments found.")

        await self.whatsapp.send_text(to=from_phone, message=no_app_text, phone_id=phone_id, access_token=access_token)
        return {"status": "no_appointment_found"}

    async def _handle_reschedule(
        self,
        from_phone: str,
        clinic_id: str,
        phone_id: Optional[str],
        access_token: Optional[str],
        language: str
    ) -> Dict[str, Any]:
        await self._handle_cancellation(from_phone, clinic_id, phone_id, access_token, language)
        return await self._handle_booking(from_phone, {"intent": "BOOK"}, clinic_id, phone_id, access_token, language)

    async def _handle_emergency(
        self,
        from_phone: str,
        clinic_id: str,
        phone_id: Optional[str],
        access_token: Optional[str],
        language: str
    ) -> Dict[str, Any]:
        clinic = await get_document("clinics", clinic_id)
        clinic_phone = clinic.get("phone", "+91-108") if clinic else "+91-108"

        emergency_msg = EMERGENCY_TEMPLATES.get(language, EMERGENCY_TEMPLATES["en"]).format(
            clinic_phone=clinic_phone
        )
        await self.whatsapp.send_text(to=from_phone, message=emergency_msg, phone_id=phone_id, access_token=access_token)

        await self.logger.log_decision(
            decision_type="emergency_redirected",
            decision_made=f"Redirected emergency message from {mask_phone(from_phone)} to 108 / {clinic_phone}",
            clinic_id=clinic_id,
            patient_phone_masked=mask_phone(from_phone)
        )
        return {"status": "emergency_redirected"}

    async def _handle_enquiry(
        self,
        from_phone: str,
        clinic_id: str,
        phone_id: Optional[str],
        access_token: Optional[str],
        language: str
    ) -> Dict[str, Any]:
        clinic = await get_document("clinics", clinic_id)
        doctor_name = clinic.get("doctor_name", "Doctor") if clinic else "Doctor"
        fees = clinic.get("consultation_fees", {}) if clinic else {}
        new_fee = fees.get("new_patient_paise", 30000) // 100
        followup_fee = fees.get("followup_paise", 15000) // 100

        today_str = get_today_ist_date_str()
        slots = await get_available_slots(clinic_id, today_str)
        next_slot_str = slots[0]["slot_time_str"] if slots else "Available tomorrow"

        hours_str = "09:00 AM - 01:00 PM, 05:00 PM - 08:00 PM"

        enquiry_msg = ENQUIRY_TEMPLATES.get(language, ENQUIRY_TEMPLATES["en"]).format(
            doctor_name=doctor_name,
            hours=hours_str,
            new_fee=new_fee,
            followup_fee=followup_fee,
            next_available=next_slot_str
        )
        await self.whatsapp.send_text(to=from_phone, message=enquiry_msg, phone_id=phone_id, access_token=access_token)

        await self.logger.log_decision(
            decision_type="enquiry_responded",
            decision_made=f"Responded to enquiry from {mask_phone(from_phone)}",
            clinic_id=clinic_id,
            patient_phone_masked=mask_phone(from_phone)
        )
        return {"status": "enquiry_responded"}

    async def _handle_other(
        self,
        from_phone: str,
        clinic_id: str,
        phone_id: Optional[str],
        access_token: Optional[str],
        language: str
    ) -> Dict[str, Any]:
        clinic = await get_document("clinics", clinic_id)
        clinic_phone = clinic.get("phone", "") if clinic else ""

        other_msg = OTHER_TEMPLATES.get(language, OTHER_TEMPLATES["en"]).format(
            clinic_phone=clinic_phone
        )
        await self.whatsapp.send_text(to=from_phone, message=other_msg, phone_id=phone_id, access_token=access_token)

        return {"status": "other_responded"}

    async def _ensure_patient_exists(self, phone: str, clinic_id: str, language: str) -> str:
        from utils.patient_identity import resolve_patient_id
        identity = await resolve_patient_id(clinic_id, phone)
        patient_id = identity["patient_id"]

        if not identity["is_new"] and identity.get("existing_patient"):
            return patient_id

        patient_data = {
            "patient_id": patient_id,
            "clinic_id": clinic_id,
            "phone": phone,
            "phone_masked": mask_phone(phone),
            "language_preference": language,
            "allergies": [],
            "chronic_conditions": [],
            "visit_count": 0,
            "consent_given": True,
            "consent_at": datetime.now(timezone.utc),
            "opted_out": False,
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        }
        await set_document("patients", patient_id, patient_data)
        return patient_id
