import os
import json
import sqlalchemy
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

def seed_test_breach():
    url = os.getenv("SUPABASE_DB_URL")
    if not url:
        print("SUPABASE_DB_URL not found")
        return

    if "psycopg" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg2://")
    else:
        url = url.replace("postgresql+psycopg://", "postgresql+psycopg2://")
    engine = sqlalchemy.create_engine(url)

    # test@bigbasket.com hash
    target_hash = "de5b47ab4bc3e23b9c8e380a721bbe435de217eed839be042d45a2c8ed4dcd8a"
    
    metadata = {
        "source": "BigBasket_Surveillance",
        "date": "2024-05-08",
        "exposed_fields": json.dumps(["email", "password_hash", "phone", "address"]),
        "hashed_identifier": target_hash,
        "raw_preview": "{'email': 'test@bigbasket.com', 'password': '••••••••'}"
    }

    text = f"Breach: BigBasket_Surveillance | Date: 2024-05-08 | Fields: email, password_hash | Hash: {target_hash}"

    query = sqlalchemy.text(
        "INSERT INTO data_breach_vectors (text, metadata_) VALUES (:t, :m)"
    )

    try:
        with engine.connect() as conn:
            conn.execute(query, {"t": text, "m": json.dumps(metadata)})
            conn.commit()
            print(f"Successfully seeded test breach for {target_hash}")
    except Exception as e:
        print(f"Failed to seed: {e}")

if __name__ == "__main__":
    seed_test_breach()
