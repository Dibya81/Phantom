import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from .routes import router

app = FastAPI(
    title="PhantomID Agent API",
    version="1.0.0",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://localhost:3000",
        os.getenv("FRONTEND_URL", "http://localhost:5173"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


def validate_env():
    required = [
        "SUPABASE_URL", "SUPABASE_KEY", "SUPABASE_DB_URL",
        "GROQ_API_KEY", "PINATA_JWT", "ANCHOR_PROGRAM_ID"
    ]
    missing = [env for env in required if not os.getenv(env)]
    if missing:
        print(f"\033[91m[CRITICAL] Missing environment variables: {', '.join(missing)}\033[0m")
        print("Please check your .env file.")
        # We don't exit(1) here to allow the dev to see the docs/logs, 
        # but we mark the system as degraded.
    else:
        print("\033[92m[OK] All critical environment variables present.\033[0m")


@app.on_event("startup")
async def startup():
    validate_env()
    print("PhantomID Agent API started")
    print("Docs: http://localhost:8000/docs")
