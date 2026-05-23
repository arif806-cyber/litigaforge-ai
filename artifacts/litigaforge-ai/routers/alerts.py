"""
LitigaForge AI — Alerts Router
WhatsApp alert and hearing reminder endpoints.
"""
from fastapi import APIRouter
from pydantic import BaseModel

from alerts.whatsapp import send_whatsapp_alert, send_hearing_reminder

router = APIRouter(tags=["alerts"])


class AlertRequest(BaseModel):
    message: str
    phone: str
    alert_type: str = "general"


class HearingReminderRequest(BaseModel):
    case_number: str
    court: str
    date: str
    party: str
    phone: str


@router.post("/alert")
async def send_alert(request: AlertRequest):
    return send_whatsapp_alert(message=request.message, to=request.phone, alert_type=request.alert_type)


@router.post("/alert/hearing")
async def hearing_reminder(request: HearingReminderRequest):
    return send_hearing_reminder(
        case_number=request.case_number, court=request.court,
        date=request.date, party=request.party, to=request.phone,
    )
