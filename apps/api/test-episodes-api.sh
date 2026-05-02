#!/bin/bash

echo "=== Testing Episodes API ==="
echo ""

# Get JWT token for clinician
echo "1. Getting JWT token for clinician@bvnhidong.vn..."
TOKEN_RESPONSE=$(curl -s -X POST "https://mibtdruhmmcatccdzjjk.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnRkcnVobW1jYXRjY2R6amprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTM2ODgsImV4cCI6MjA5MzEyOTY4OH0.7A7l87spYM7piBrId-alV-9ubvsAY971BsSuXKakM4g" \
  -H "Content-Type: application/json" \
  -d '{"email": "clinician@bvnhidong.vn", "password": "Test1234!"}')

TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token"
  echo "Response: $TOKEN_RESPONSE"
  exit 1
fi

echo "✅ Token obtained: ${TOKEN:0:20}..."
echo ""

# Test GET /api/episodes
echo "2. Testing GET /api/episodes..."
curl -s -X GET "http://localhost:3005/api/episodes?limit=5" \
  -H "Authorization: Bearer $TOKEN" | head -20
echo ""
echo ""

# Test POST /api/episodes
echo "3. Testing POST /api/episodes (create episode)..."
CREATE_RESPONSE=$(curl -s -X POST "http://localhost:3005/api/episodes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_ref": "BN-2024-TEST-001",
    "age": "5 tuổi",
    "gender": "Nam",
    "admission_date": "2024-01-15",
    "chief_complaint": "Sốt, ho"
  }')

echo "$CREATE_RESPONSE" | head -20
EPISODE_ID=$(echo $CREATE_RESPONSE | grep -o '"episode_id":"[^"]*' | cut -d'"' -f4)
echo ""
echo "Episode ID: $EPISODE_ID"
echo ""

# Test GET /api/episodes/:id
if [ ! -z "$EPISODE_ID" ]; then
  echo "4. Testing GET /api/episodes/$EPISODE_ID..."
  curl -s -X GET "http://localhost:3005/api/episodes/$EPISODE_ID" \
    -H "Authorization: Bearer $TOKEN" | head -20
  echo ""
  echo ""
  
  # Test PATCH /api/episodes/:id
  echo "5. Testing PATCH /api/episodes/$EPISODE_ID..."
  curl -s -X PATCH "http://localhost:3005/api/episodes/$EPISODE_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"status": "pending_explain", "findings": ["Consolidation"]}' | head -20
  echo ""
fi

echo ""
echo "=== Tests Complete ==="
