import os
import hashlib
import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Header, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from google_auth_oauthlib.flow import Flow

from .ws_manager import manager
from .db import (
    store_user,
    get_user_by_pseudonym,
    store_gmail_tokens,
    get_threat_history,
    get_credentials,
)
from agent.graph.agent import run_agent

router = APIRouter()

# ── Helpers ───────────────────────────────────────────────────────────────────

def _sha256(value: str) -> str:
    return hashlib.sha256(value.strip().lower().encode()).hexdigest()

def _make_pseudonym(*hashes: str) -> str:
    combined = "".join(hashes)
    return hashlib.sha256(combined.encode()).hexdigest()

GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar.readonly",
]

def _get_oauth_flow(state: str | None = None) -> Flow:
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/connect-gmail/callback")],
            }
        },
        scopes=GOOGLE_SCOPES,
        state=state,
    )
    flow.redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/connect-gmail/callback")
    return flow


# ── Request / Response models ─────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    phone: str
    pan_prefix: str


class RegisterResponse(BaseModel):
    user_token: str
    message: str


# ═══════════════════════════════════════════════════════════════════════════════
# POST /register
# ═══════════════════════════════════════════════════════════════════════════════
@router.post("/register", response_model=RegisterResponse)
async def register(body: RegisterRequest):
    print(f"[API] Registration request for {body.email}")
    if not body.email or not body.phone or not body.pan_prefix:
        raise HTTPException(status_code=422, detail="email, phone, and pan_prefix are required")

    try:
        hashed_email = _sha256(body.email)
        hashed_phone = _sha256(body.phone)
        hashed_pan   = _sha256(body.pan_prefix)
        user_pseudonym = _make_pseudonym(hashed_email, hashed_phone, hashed_pan)

        print(f"[API] Storing user {user_pseudonym} in Supabase...")
        await store_user(
            user_pseudonym=user_pseudonym,
            hashed_email=hashed_email,
            hashed_phone=hashed_phone,
            hashed_pan=hashed_pan,
            raw_phone=body.phone,
        )

        # Wire the WS broadcaster so graph nodes can emit events
        async def _broadcaster(event: dict):
            await manager.send_to_user(user_pseudonym, event)

        print(f"[API] Initializing agent for {user_pseudonym}...")
        # Start agent loop in background — non-blocking
        asyncio.create_task(
            run_agent(
                hashed_identifier=hashed_email,
                user_pseudonym=user_pseudonym,
                phone_number=body.phone,
                broadcaster=_broadcaster,
            )
        )

        return RegisterResponse(
            user_token=user_pseudonym,
            message="Agent activated. Connect to /ws/agent to stream live events.",
        )
    except Exception as e:
        print(f"[API] Registration FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# POST /connect-gmail  →  redirect to Google OAuth
# ═══════════════════════════════════════════════════════════════════════════════
@router.post("/connect-gmail")
async def connect_gmail(x_user_token: str = Header(..., alias="X-User-Token")):
    user = await get_user_by_pseudonym(x_user_token)
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Register first.")

    flow = _get_oauth_flow(state=x_user_token)   # pass pseudonym as state
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return {"auth_url": auth_url}


# ═══════════════════════════════════════════════════════════════════════════════
# GET /connect-gmail/callback  ←  Google redirects here
# ═══════════════════════════════════════════════════════════════════════════════
@router.get("/connect-gmail/callback")
async def gmail_callback(request: Request):
    state = request.query_params.get("state")  # this is the user_pseudonym
    code  = request.query_params.get("code")

    if not state or not code:
        raise HTTPException(status_code=400, detail="Missing state or code from Google")

    flow = _get_oauth_flow(state=state)
    flow.fetch_token(code=code)
    tokens = {
        "token":         flow.credentials.token,
        "refresh_token": flow.credentials.refresh_token,
        "token_uri":     flow.credentials.token_uri,
        "client_id":     flow.credentials.client_id,
        "client_secret": flow.credentials.client_secret,
        "scopes":        list(flow.credentials.scopes or []),
    }

    await store_gmail_tokens(user_pseudonym=state, tokens=tokens)

    # Redirect to frontend credential connected screen
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    return RedirectResponse(url=f"{frontend_url}?gmail=connected")


# ═══════════════════════════════════════════════════════════════════════════════
# GET /threats
# ═══════════════════════════════════════════════════════════════════════════════
@router.get("/threats")
async def get_threats(x_user_token: str = Header(..., alias="X-User-Token")):
    if not x_user_token:
        raise HTTPException(status_code=401, detail="X-User-Token header required")

    history = await get_threat_history(x_user_token)
    return {
        "user_pseudonym": x_user_token,
        "threats": history,
        "count": len(history),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# GET /credentials
# ═══════════════════════════════════════════════════════════════════════════════
@router.get("/credentials")
async def get_user_credentials(x_user_token: str = Header(..., alias="X-User-Token")):
    if not x_user_token:
        raise HTTPException(status_code=401, detail="X-User-Token header required")

    creds = await get_credentials(x_user_token)
    return {
        "user_pseudonym": x_user_token,
        "credentials": creds,
        "count": len(creds),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# WS /ws/agent
# ═══════════════════════════════════════════════════════════════════════════════
@router.websocket("/ws/agent")
async def ws_agent(websocket: WebSocket, token: str = None):
    """
    Query param: ws://localhost:8000/ws/agent?token=<user_pseudonym>
    Falls back to wildcard "*" if no token — receives all broadcasts (demo mode).
    """
    user_key = token if token else "*"
    await manager.connect(websocket, user_key)

    # Send a handshake event so frontend knows it's live
    await websocket.send_json({
        "event": "CONNECTED",
        "node": "System",
        "payload": {"message": "PhantomID agent stream connected", "user_key": user_key},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    try:
        while True:
            # Keep connection alive — frontend sends pings, we ignore content
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_key)
