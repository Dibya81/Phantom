import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
import re
import json

# Load environment
load_dotenv()
DB_URL = os.environ.get("SUPABASE_DB_URL")
SQL_FILE = "/Users/dibyabhusal/Downloads/phantomid/breach_data/final_consolidated_dump.sql"

if not DB_URL:
    print("❌ Error: SUPABASE_DB_URL not found in .env")
    exit(1)

# Clean DB_URL for psycopg2
if "postgresql+psycopg://" in DB_URL:
    DB_URL = DB_URL.replace("postgresql+psycopg://", "postgresql://")
elif "postgresql+psycopg2://" in DB_URL:
    DB_URL = DB_URL.replace("postgresql+psycopg2://", "postgresql://")

def run_import():
    print(f"📂 Streaming consolidated data from {SQL_FILE} to data_breach_vectors...")
    
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        batch_size = 500
        batch = []
        count = 0
        
        with open(SQL_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line.startswith("('") or not line.endswith("'),") and not line.endswith("');"):
                    continue
                
                # Strip leading (' and trailing '), or ');
                core = line[2:-3] if line.endswith("'),") else line[2:-3]
                
                # Split by the separator ', ' but only the LAST occurrence to separate text and metadata
                parts = core.rsplit("', '", 1)
                if len(parts) == 2:
                    t, m = parts
                    clean_t = t.replace("''", "'")
                    clean_m = m.replace("''", "'")
                    
                    # Validate JSON
                    try:
                        json.loads(clean_m)
                    except:
                        # If it's still broken, skip or try to fix
                        continue

                    batch.append((clean_t, clean_m))
                    
                    if len(batch) >= batch_size:
                        psycopg2.extras.execute_values(
                            cur,
                            "INSERT INTO data_breach_vectors (text, metadata_) VALUES %s",
                            batch
                        )
                        conn.commit()
                        count += len(batch)
                        print(f"🚀 Progress: {count} records ingested...")
                        batch = []
        
        # Final batch
        if batch:
            psycopg2.extras.execute_values(
                cur,
                "INSERT INTO data_breach_vectors (text, metadata_) VALUES %s",
                batch
            )
            conn.commit()
            count += len(batch)

        cur.close()
        conn.close()
        print(f"\n✨ SUCCESS: Fully ingested {count} records safely into data_breach_vectors.")
        
    except Exception as e:
        print(f"\n❌ FAILED at record {count}: {e}")

if __name__ == "__main__":
    run_import()
