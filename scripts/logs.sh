#!/bin/bash

# Script to view logs from both servers

if [ "$1" == "api" ]; then
    echo "=== Backend API Logs ==="
    tail -f logs/api.log
elif [ "$1" == "web" ]; then
    echo "=== Frontend Web Logs ==="
    tail -f logs/web.log
else
    echo "Usage: ./scripts/logs.sh [api|web]"
    echo ""
    echo "Or view logs manually:"
    echo "  Backend:  tail -f logs/api.log"
    echo "  Frontend: tail -f logs/web.log"
fi
