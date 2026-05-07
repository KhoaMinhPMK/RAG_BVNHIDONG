#!/bin/bash

# Script to stop both backend and frontend servers

echo "Stopping development servers..."

# Stop backend
if [ -f logs/api.pid ]; then
    API_PID=$(cat logs/api.pid)
    echo "Stopping backend (PID: $API_PID)..."
    kill $API_PID 2>/dev/null || echo "Backend already stopped"
    rm logs/api.pid
else
    echo "Backend PID file not found"
fi

# Stop frontend
if [ -f logs/web.pid ]; then
    WEB_PID=$(cat logs/web.pid)
    echo "Stopping frontend (PID: $WEB_PID)..."
    kill $WEB_PID 2>/dev/null || echo "Frontend already stopped"
    rm logs/web.pid
else
    echo "Frontend PID file not found"
fi

echo "✓ Servers stopped"
