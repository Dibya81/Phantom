import os
from typing import Optional, List, Any
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
from intelligence.rag.query import query_breach_db

router = APIRouter()
 
@router.get("/")
async def root():
    return {
        "status": "online",
        "service": "PhantomID Agent API",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

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
    password: str


class RegisterResponse(BaseModel):
    user_token: str
    email: str
    message: str

class LoginRequest(BaseModel):
    email: str
    password: str

class BreachMatch(BaseModel):
    breach: str
    date: str
    domain: str
    exposed_fields: list[str]
    records: int
    summary: str

class DetectionResponse(BaseModel):
    success: bool
    matches: list[BreachMatch]
    confidence: float
    risk_level: str
    message: str | None = None


# ═══════════════════════════════════════════════════════════════════════════════
# POST /register
# ═══════════════════════════════════════════════════════════════════════════════
@router.post("/register", response_model=RegisterResponse)
async def register(body: RegisterRequest):
    print(f"[API] Registration request for {body.email}")
    if not body.email or not body.phone or not body.password:
        raise HTTPException(status_code=422, detail="email, phone, and password are required")

    try:
        hashed_email = _sha256(body.email)
        hashed_phone = _sha256(body.phone)
        # Pseudonym derived from email + phone
        user_pseudonym = _make_pseudonym(hashed_email, hashed_phone)

        print(f"[API] Storing user {user_pseudonym} in Supabase...")
        try:
            await store_user(
                user_pseudonym=user_pseudonym,
                hashed_email=hashed_email,
                hashed_phone=hashed_phone,
                raw_phone=body.phone,
                password=body.password
            )
        except Exception as e:
            if "duplicate key" in str(e).lower() or "23505" in str(e):
                raise HTTPException(status_code=400, detail="This email is already registered.")
            raise e

        # Wire the WS broadcaster so graph nodes can emit events
        async def _broadcaster(event: dict):
            await manager.send_to_user(user_pseudonym, event)

        print(f"[API] Initializing agent for {user_pseudonym}...")
        # Start agent loop in background — non-blocking
        asyncio.create_task(
            run_agent(
                hashed_identifier=hashed_email,
                raw_identifier=body.email,
                user_pseudonym=user_pseudonym,
                phone_number=body.phone,
                broadcaster=_broadcaster,
            )
        )

        return RegisterResponse(
            user_token=user_pseudonym,
            email=body.email,
            message="Account created. Identity monitoring activated.",
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[API] Registration FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error during registration")
# ═══════════════════════════════════════════════════════════════════════════════
# POST /login
# ═══════════════════════════════════════════════════════════════════════════════
@router.post("/login", response_model=RegisterResponse)
async def login(body: LoginRequest):
    print(f"[API] Login request for {body.email}")
    try:
        from .db import verify_user
        user = await verify_user(body.email, body.password)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        return RegisterResponse(
            user_token=user["user_pseudonym"],
            email=body.email,
            message="Welcome back, Agent.",
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[API] Login FAILED: {str(e)}")
        raise HTTPException(status_code=500, detail="Authentication error")


# ═══════════════════════════════════════════════════════════════════════════════
# POST /detect-breach
# ═══════════════════════════════════════════════════════════════════════════════
@router.post("/detect-breach", response_model=DetectionResponse)
async def detect_breach(body: Request, x_user_token: Optional[str] = Header(None, alias="X-User-Token")):
    try:
        data = await body.json()
        email = data.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="email is required")

        hashed_email = _sha256(email)
        
        # Real intelligence check
        result = await asyncio.to_thread(query_breach_db, hashed_email, email)

        matches = []
        for m in result.get("matches", []):
            matches.append(BreachMatch(
                breach=m.get("source", "Unknown"),
                date=m.get("date", "Unknown"),
                domain=email.split("@")[-1] if "@" in email else "unknown",
                exposed_fields=m.get("exposed_fields", []),
                records=m.get("records_affected", 0),
                summary=m.get("raw_preview", f"Breach detected in {m.get('source')}")
            ))

        # Check if user is logged in to trigger background reasoning/anchoring
        token = manager.get_token_from_request(body) # Need to implement this or use header
        # For simplicity, if matches found, we trigger agent if we can find the user
        
        # Look for user by email hash
        from .db import get_db
        db = get_db()
        user_res = db.table("users").select("*").eq("hashed_email", hashed_email).execute()
        
        # ALWAYS trigger background agent cycle if matches found
        # Use pure hex pseudonym to avoid blockchain fromhex() errors
        user_pseudonym = hashed_email
        raw_phone = ""
        
        if user_res.data:
            user = user_res.data[0]
            user_pseudonym = user["user_pseudonym"]
            raw_phone = user.get("raw_phone", "")
            
        async def _broadcaster(event: dict):
            # 1. Target the specific user being audited (for their vault/history)
            await manager.send_to_user(user_pseudonym, event)
            
            # 2. ALSO target the session that requested the scan (for real-time UI)
            # If no token, use "*" (global broadcast for demo mode)
            requester_key = x_user_token if x_user_token else "*"
            if requester_key != user_pseudonym:
                await manager.send_to_user(requester_key, event)
            
        asyncio.create_task(
            run_agent(
                hashed_identifier=hashed_email,
                raw_identifier=email,
                user_pseudonym=user_pseudonym,
                phone_number=raw_phone,
                broadcaster=_broadcaster,
            )
        )

        return DetectionResponse(
            success=True,
            matches=matches,
            confidence=result.get("confidence", 0.9),
            risk_level=result.get("risk_level", "LOW"),
            message=None if matches else "No direct breach match found"
        )
    except Exception as e:
        print(f"[API] Detection FAILED: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")


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
async def fetch_credentials(x_user_token: str = Header(..., alias="X-User-Token")):
    if not x_user_token:
        raise HTTPException(status_code=401, detail="X-User-Token header required")
    
    creds = await get_credentials(x_user_token)
    return {
        "user_pseudonym": x_user_token,
        "credentials": creds,
        "count": len(creds),
    }

# ═══════════════════════════════════════════════════════════════════════════════
# GET /profile
# ═══════════════════════════════════════════════════════════════════════════════
@router.get("/profile")
async def get_profile(x_user_token: str = Header(..., alias="X-User-Token")):
    user = await get_user_by_pseudonym(x_user_token)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get latest risk level from threat history
    history = await get_threat_history(x_user_token)
    latest_risk = "LOW"
    if history:
        latest_risk = history[0].get("risk_level", "LOW")

    # Get global scan history (last 10 unique hashes)
    db = get_db()
    global_res = db.table("users").select("hashed_email").order("created_at", desc=True).limit(10).execute()
    recent_scans = global_res.data if global_res.data else []

    return {
        "pseudonym": user["user_pseudonym"],
        "hashed_email": user["hashed_email"],
        "hashed_phone": user["hashed_phone"],
        "risk_level": latest_risk,
        "breach_count": len(history),
        "last_scan": history[0].get("detected_at") if history else None,
        "recent_global_scans": recent_scans
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
