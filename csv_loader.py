import os
import csv
import json
import hashlib
import sqlalchemy
from dotenv import load_dotenv

load_dotenv()

CSV_FILE = "/Users/dibyabhusal/Downloads/phantomid/breach_data/1000_breached_users_list.csv"
DB_URL = os.getenv("SUPABASE_DB_URL")

def normalize_id(id_str):
    id_str = id_str.strip().lower()
    if "@" in id_str:
        return id_str
    # If it's a phone number, keep only digits
    return "".join(filter(str.isdigit, id_str))

def get_hash(id_str):
    normalized = normalize_id(id_str)
    return hashlib.sha256(normalized.encode()).hexdigest()

def ingest_csv():
    if not DB_URL:
        print("❌ Error: SUPABASE_DB_URL not found")
        return

    url = DB_URL.replace("postgresql://", "postgresql+psycopg2://")
    if "psycopg" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg2://")
    else:
        url = url.replace("postgresql+psycopg://", "postgresql+psycopg2://")
        
    engine = sqlalchemy.create_engine(url)

    print("🗑 Truncating data_breach_vectors...")
    with engine.connect() as conn:
        conn.execute(sqlalchemy.text("TRUNCATE TABLE data_breach_vectors;"))
        # Also clear other tables as requested "forget about all previous"
        conn.execute(sqlalchemy.text("TRUNCATE TABLE breach_vectors;"))
        conn.execute(sqlalchemy.text("TRUNCATE TABLE detection_events;"))
        conn.execute(sqlalchemy.text("TRUNCATE TABLE threat_events;"))
        conn.commit()

    print(f"📂 Reading CSV: {CSV_FILE}")
    records = []
    with open(CSV_FILE, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            main_id = row['Main_ID']
            name = row['Name']
            source = row['Breach_Source']
            date = row['Date']
            how = row['How_It_Got_Breached']
            
            h = get_hash(main_id)
            
            text = f"Breach: {source} | User: {name} | Date: {date} | Method: {how} | ID Hash: {h}"
            
            metadata = {
                "source": source,
                "date": date,
                "how": how,
                "name": name,
                "hashed_identifier": h,
                "exposed_fields": json.dumps(["email", "name", "breach_details"]) if "@" in main_id else json.dumps(["phone", "name", "breach_details"]),
                "raw_preview": f"Breached via {how} in {source} leak ({date})"
            }
            
            records.append({
                "text": text,
                "metadata_": json.dumps(metadata)
            })

    print(f"🚀 Ingesting {len(records)} records...")
    
    insert_query = sqlalchemy.text(
        "INSERT INTO data_breach_vectors (text, metadata_) VALUES (:text, :metadata_)"
    )
    
    batch_size = 100
    with engine.connect() as conn:
        for i in range(0, len(records), batch_size):
            batch = records[i:i+batch_size]
            conn.execute(insert_query, batch)
            print(f"   Injected {i + len(batch)}/{len(records)}")
        conn.commit()

    print("\n✨ SUCCESS: Database reset and re-populated with 1000_breached_users_list.csv")

if __name__ == "__main__":
    ingest_csv()
