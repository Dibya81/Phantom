# test_google_mcp.py
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

import sys
sys.path.insert(0, ".")

from agent.mcp import gmail_mcp, calendar_mcp

async def main():
    # 1. Mock tokens (Replace with real ones for live test)
    # To get real tokens, you usually go through the Google OAuth flow.
    mock_tokens = {
        "token": "MOCK_ACCESS_TOKEN",
        "refresh_token": "MOCK_REFRESH_TOKEN",
        "token_uri": "https://oauth2.googleapis.com/token",
        "client_id": os.getenv("GOOGLE_CLIENT_ID"),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
    }

    print("--- Testing Gmail MCP ---")
    gmail_signals = gmail_mcp.get_signals(
        user_pseudonym="test_user_sha256",
        tokens=mock_tokens
    )
    print(f"Gmail Signals: {gmail_signals}")

    print("\n--- Testing Calendar MCP ---")
    calendar_signals = calendar_mcp.get_signals(
        user_pseudonym="test_user_sha256",
        breach_timestamp="2024-05-08T02:00:00Z", # 2 AM UTC -> 7:30 AM IST (not sleep)
        tokens=mock_tokens
    )
    print(f"Calendar Signals (Non-Sleep): {calendar_signals}")

    calendar_signals_sleep = calendar_mcp.get_signals(
        user_pseudonym="test_user_sha256",
        breach_timestamp="2024-05-08T18:00:00Z", # 6 PM UTC -> 11:30 PM IST (SLEEP)
        tokens=mock_tokens
    )
    print(f"Calendar Signals (Sleep Window): {calendar_signals_sleep}")

if __name__ == "__main__":
    asyncio.run(main())
