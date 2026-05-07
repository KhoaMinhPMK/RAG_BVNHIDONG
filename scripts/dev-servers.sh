#!/bin/bash

# Script to run both backend and frontend in background

echo "Starting development servers..."

# Create logs directory if not exists
mkdir -p logs

# Start backend API
echo "Starting backend API on port 3000..."
cd apps/api
yarn dev > ../../logs/api.log 2>&1 &
API_PID=$!
echo $API_PID > ../../logs/api.pid
echo "Backend started with PID: $API_PID"

# Start frontend web
echo "Starting frontend web on port 3001..."
cd ../web
yarn dev > ../../logs/web.log 2>&1 &
WEB_PID=$!
echo $WEB_PID > ../../logs/web.pid
echo "Frontend started with PID: $WEB_PID"

cd ../..

echo ""
echo "✓ Both servers are running in background"
echo "  - Backend API: http://localhost:3000 (PID: $API_PID)"
echo "  - Frontend Web: http://localhost:3001 (PID: $WEB_PID)"
echo ""
echo "Logs:"
echo "  - Backend: logs/api.log"
echo "  - Frontend: logs/web.log"
echo ""
echo "To stop servers, run: ./scripts/stop-servers.sh"
