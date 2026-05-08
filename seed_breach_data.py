import os
import sqlalchemy
from sqlalchemy import text
from dotenv import load_dotenv
import json

load_dotenv()

url = os.environ.get("SUPABASE_DB_URL")
if not url:
    print("Error: SUPABASE_DB_URL not found in .env")
    exit(1)

engine = sqlalchemy.create_engine(url)

data = [
    ("MobiKwik 2021 breach exposing email and phone numbers", {"source":"MobiKwik","year":2021,"exposed_fields":["email","phone"],"type":"fintech"}),
    ("MobiKwik database leak including KYC metadata and wallet balances", {"source":"MobiKwik","year":2021,"exposed_fields":["phone","kyc","wallet"],"type":"financial"}),
    ("Dominos India 2021 breach exposing customer phone, address, order history", {"source":"Dominos","year":2021,"exposed_fields":["phone","address","orders"],"type":"food"}),
    ("Dominos database leak affecting millions of Indian users", {"source":"Dominos","year":2021,"exposed_fields":["phone","email"],"type":"consumer"}),
    ("CoWIN data exposure including vaccination status and phone numbers", {"source":"CoWIN","year":2023,"exposed_fields":["phone","health"],"type":"government"}),
    ("BigBasket 2020 breach exposing email, phone and hashed passwords", {"source":"BigBasket","year":2020,"exposed_fields":["email","phone","password"],"type":"ecommerce"}),
    ("Air India 2021 breach exposing passport details and DOB", {"source":"AirIndia","year":2021,"exposed_fields":["passport","dob","email"],"type":"aviation"}),
    ("COMB dataset leak containing billions of credentials across multiple breaches", {"source":"COMB","year":2021,"exposed_fields":["email","password"],"type":"aggregated"}),
    ("CERT-In advisory warning about credential stuffing attacks targeting Indian users", {"source":"CERT-IN","year":2024,"exposed_fields":["email"],"type":"advisory"})
]

try:
    with engine.connect() as conn:
        for t, m in data:
            conn.execute(
                text("INSERT INTO breach_vectors (text, metadata) VALUES (:t, :m)"),
                {"t": t, "m": json.dumps(m)}
            )
        conn.commit()
    print("SUCCESS: Demo data inserted into breach_vectors.")
except Exception as e:
    print(f"FAILED: {e}")
