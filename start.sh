#!/bin/bash
set -e
echo "Starting PhantomID..."

# 1. Backend (FastAPI Agent)
cd "$(dirname "$0")"
if [ -f "venv/bin/uvicorn" ]; then
  echo "Using virtual environment..."
  venv/bin/uvicorn agent.api.main:app --host 0.0.0.0 --port 8000 --reload &
else
  echo "Virtual environment not found, trying system uvicorn..."
  uvicorn agent.api.main:app --host 0.0.0.0 --port 8000 --reload &
fi
AGENT_PID=$!

# 2. Frontend
cd agent/frontend
if [ ! -d "node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm install
fi
npm run dev &
FE_PID=$!

echo "Agent API: http://localhost:8000/docs"
echo "Frontend:  http://localhost:5173"

# Cleanup on exit
trap "kill $AGENT_PID $FE_PID" EXIT
wait
