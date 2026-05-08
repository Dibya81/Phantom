# save as test_twilio_whatsapp.py in project root — run with: python test_twilio_whatsapp.py
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

# Temporarily add project root to path
import sys
sys.path.insert(0, ".")

from agent.notifications.whatsapp import send_alert

asyncio.run(send_alert(
    phone="+916299266546",        # ← put YOUR phone number here (must have joined sandbox)
    match={
        "source": "MobiKwik_2021",
        "exposed_fields": ["email", "phone", "password_hash"],
    },
    risk_level="HIGH",
    user_pseudonym="a3f5c2d1e4b6789012345678abcdef0123456789abcdef0123456789abcdef01",
))
