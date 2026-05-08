import asyncio
from fastapi import WebSocket
from typing import Dict


class WSManager:
    def __init__(self):
        # keyed by user_pseudonym so we can target specific users
        # also supports a "*" broadcast key for demo mode
        self._connections: Dict[str, list[WebSocket]] = {}

    async def connect(self, ws: WebSocket, user_pseudonym: str = "*"):
        await ws.accept()
        self._connections.setdefault(user_pseudonym, []).append(ws)

    def disconnect(self, ws: WebSocket, user_pseudonym: str = "*"):
        conns = self._connections.get(user_pseudonym, [])
        if ws in conns:
            conns.remove(ws)

    async def send_to_user(self, user_pseudonym: str, data: dict):
        """Send event to a specific user's connections + all wildcard connections."""
        targets = (
            self._connections.get(user_pseudonym, [])
            + self._connections.get("*", [])
        )
        dead = []
        for ws in targets:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append((ws, user_pseudonym))

        # Clean up dead connections
        for ws, key in dead:
            self.disconnect(ws, key)

    async def broadcast(self, data: dict):
        """Broadcast to all connected clients regardless of user."""
        all_ws = [ws for conns in self._connections.values() for ws in conns]
        dead = []
        for ws in all_ws:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            for key, conns in self._connections.items():
                if ws in conns:
                    conns.remove(ws)


    def get_token_from_request(self, request) -> str | None:
        """Helper to extract token from query params or headers."""
        # Check query params first (for WebSockets)
        token = request.query_params.get("token")
        if token:
            return token
        # Check X-User-Token header (for REST)
        return request.headers.get("X-User-Token")

manager = WSManager()
