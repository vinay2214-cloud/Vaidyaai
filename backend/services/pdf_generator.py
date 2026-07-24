import io
import asyncio
import logging
from typing import Dict, Any, List, Optional
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

logger = logging.getLogger("vaidyaai.services.pdf_generator")


def _generate_prescription_pdf_sync(
    clinic_info: Dict[str, Any],
    patient_info: Dict[str, Any],
    consultation_data: Dict[str, Any]
) -> bytes:
    """
    Generates a healthcare-grade PDF prescription using ReportLab.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'ClinicTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0f766e')
    )

    doctor_style = ParagraphStyle(
        'DoctorName',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=colors.HexColor('#0f172a')
    )

    sub_style = ParagraphStyle(
        'SubText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#64748b')
    )

    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#0f766e'),
        spaceAfter=6
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor('#1e293b')
    )

    elements = []

    # 1. Header: Clinic Name & Doctor Info
    clinic_name = clinic_info.get("name", "VaidyaAI Medical Clinic")
    doctor_name = clinic_info.get("doctor_name", "Dr. Doctor")
    speciality = clinic_info.get("speciality", "General Medicine")
    phone = clinic_info.get("phone", "+91-9876543210")
    location = clinic_info.get("location", "Tirupati, AP")

    elements.append(Paragraph(clinic_name, title_style))
    elements.append(Paragraph(f"{doctor_name} — <font color='#64748b'>{speciality}</font>", doctor_style))
    elements.append(Paragraph(f"Phone: {phone} | Location: {location}", sub_style))
    elements.append(Spacer(1, 8))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0d9488'), spaceAfter=12))

    # 2. Patient Details Bar
    patient_name = patient_info.get("name", "Patient")
    phone_masked = patient_info.get("phone_masked", "XXXX")
    date_str = consultation_data.get("date_str", "Today")
    rx_no = f"Rx-{consultation_data.get('consultation_id', '1001')[-6:]}"

    patient_table_data = [
        [
            Paragraph(f"<b>Patient:</b> {patient_name}", body_style),
            Paragraph(f"<b>Phone:</b> {phone_masked}", body_style),
            Paragraph(f"<b>Date:</b> {date_str}", body_style),
            Paragraph(f"<b>Rx No:</b> {rx_no}", body_style)
        ]
    ]
    patient_table = Table(patient_table_data, colWidths=[1.8*inch, 1.8*inch, 1.8*inch, 1.8*inch])
    patient_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f0fdfa')),
        ('PADDING', (0,0), (-1,-1), 8),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#ccfbf1')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elements.append(patient_table)
    elements.append(Spacer(1, 12))

    # 3. Diagnoses / Assessment
    diagnoses = consultation_data.get("diagnoses", [])
    if diagnoses:
        elements.append(Paragraph("DIAGNOSES / ASSESSMENT", section_heading))
        diag_items = []
        for d in diagnoses:
            code = d.get("code", "")
            desc = d.get("description", "")
            diag_items.append(f"• {desc} ({code})" if code else f"• {desc}")
        elements.append(Paragraph("<br/>".join(diag_items), body_style))
        elements.append(Spacer(1, 10))

    # 4. Rx Medications Table
    medications = consultation_data.get("medications", [])
    if medications:
        elements.append(Paragraph("Rx — PRESCRIPTION MEDICATIONS", section_heading))
        med_table_data = [
            ["#", "Medication / Drug Name", "Dosage", "Frequency", "Duration", "Instructions"]
        ]
        for idx, m in enumerate(medications, 1):
            med_table_data.append([
                str(idx),
                m.get("drug_name", ""),
                m.get("dosage", ""),
                m.get("frequency", ""),
                m.get("duration", ""),
                m.get("instructions", "")
            ])

        med_table = Table(med_table_data, colWidths=[0.4*inch, 2.3*inch, 1.0*inch, 1.2*inch, 1.0*inch, 1.3*inch])
        med_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f766e')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 9),
            ('BOTTOMPADDING', (0,0), (-1,0), 6),
            ('TOPPADDING', (0,0), (-1,0), 6),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')]),
            ('FONTSIZE', (0,1), (-1,-1), 8.5),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        elements.append(med_table)
        elements.append(Spacer(1, 12))

    # 5. Investigations & Follow-Up Advice
    investigations = consultation_data.get("investigations", [])
    if investigations:
        elements.append(Paragraph("INVESTIGATIONS ADVISED", section_heading))
        inv_items = [f"• {inv}" for inv in investigations]
        elements.append(Paragraph("<br/>".join(inv_items), body_style))
        elements.append(Spacer(1, 10))

    followup_days = consultation_data.get("followup_days", 5)
    elements.append(Paragraph(f"<b>Follow-Up Advice:</b> Please review in {followup_days} days or if symptoms worsen.", body_style))
    elements.append(Spacer(1, 20))

    # 6. Doctor Signature Footer
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#cbd5e1'), spaceAfter=12))
    sig_data = [
        [
            Paragraph("<i>Generated by VaidyaAI Scribe</i>", sub_style),
            Paragraph(f"<b>{doctor_name}</b><br/>Digitally Signed & Approved", ParagraphStyle('RightSig', parent=sub_style, alignment=2))
        ]
    ]
    sig_table = Table(sig_data, colWidths=[3.6*inch, 3.6*inch])
    elements.append(sig_table)

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()


async def generate_prescription_pdf(
    clinic_info: Dict[str, Any],
    patient_info: Dict[str, Any],
    consultation_data: Dict[str, Any]
) -> bytes:
    """Async wrapper for ReportLab PDF prescription generation."""
    return await asyncio.to_thread(
        _generate_prescription_pdf_sync,
        clinic_info,
        patient_info,
        consultation_data
    )
