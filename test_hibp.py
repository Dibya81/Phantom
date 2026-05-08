# test_hibp.py
import os
import sys
from dotenv import load_dotenv

load_dotenv()

# Add project root to path
sys.path.insert(0, ".")

from intelligence.rag.query import _query_hibp

def test_hibp():
    test_email = "adobe@example.com"
    print(f"--- Querying HIBP for: {test_email} ---")
    results = _query_hibp(test_email)
    
    if results:
        print(f"SUCCESS: Found {len(results)} breaches for {test_email}")
        for r in results[:3]: # Show first 3
            print(f" - {r['source']} ({r['date']})")
    else:
        print("NO RESULTS: Either the email is clean, the API call failed, or an API key is required and missing.")

if __name__ == "__main__":
    test_hibp()
