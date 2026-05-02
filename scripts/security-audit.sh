#!/bin/bash

# Security Audit Script for WebRAG API
# Purpose: Automated security checks
# Owner: BE3 (DevOps)
# Date: 2026-05-02

set -e

echo "🔒 WebRAG Security Audit"
echo "========================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
ISSUES_FOUND=0

# ============================================================================
# 1. Check for exposed secrets
# ============================================================================
echo "1️⃣  Checking for exposed secrets..."

if grep -r "SUPABASE_SERVICE_ROLE_KEY" apps/ --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" 2>/dev/null | grep -v "process.env" | grep -v "SUPABASE_SERVICE_ROLE_KEY="; then
    echo -e "${RED}❌ Found exposed Supabase service role key in code${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "${GREEN}✅ No exposed Supabase keys${NC}"
fi

if grep -r "sk-" apps/ --include="*.ts" --include="*.js" 2>/dev/null | grep -v "process.env"; then
    echo -e "${RED}❌ Found potential API keys in code${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "${GREEN}✅ No exposed API keys${NC}"
fi

if grep -r "password.*=.*['\"]" apps/ --include="*.ts" --include="*.js" 2>/dev/null | grep -v "process.env" | grep -v "// " | grep -v "password: z.string()"; then
    echo -e "${RED}❌ Found hardcoded passwords${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "${GREEN}✅ No hardcoded passwords${NC}"
fi

echo ""

# ============================================================================
# 2. Check .env files are gitignored
# ============================================================================
echo "2️⃣  Checking .env files..."

if [ -f .env ] && ! grep -q "^\.env$" .gitignore 2>/dev/null; then
    echo -e "${RED}❌ .env file exists but not in .gitignore${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "${GREEN}✅ .env properly gitignored${NC}"
fi

echo ""

# ============================================================================
# 3. Dependency vulnerabilities
# ============================================================================
echo "3️⃣  Checking dependency vulnerabilities..."

cd apps/api

# Run npm audit
AUDIT_OUTPUT=$(npm audit --json 2>/dev/null || echo '{}')
CRITICAL=$(echo "$AUDIT_OUTPUT" | grep -o '"critical":[0-9]*' | cut -d':' -f2 || echo "0")
HIGH=$(echo "$AUDIT_OUTPUT" | grep -o '"high":[0-9]*' | cut -d':' -f2 || echo "0")
MODERATE=$(echo "$AUDIT_OUTPUT" | grep -o '"moderate":[0-9]*' | cut -d':' -f2 || echo "0")

if [ "$CRITICAL" -gt 0 ]; then
    echo -e "${RED}❌ Found $CRITICAL critical vulnerabilities${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + CRITICAL))
elif [ "$HIGH" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found $HIGH high vulnerabilities${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + HIGH))
elif [ "$MODERATE" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found $MODERATE moderate vulnerabilities${NC}"
else
    echo -e "${GREEN}✅ No critical vulnerabilities found${NC}"
fi

cd ../..

echo ""

# ============================================================================
# 4. Check security headers
# ============================================================================
echo "4️⃣  Checking security headers configuration..."

if grep -q "helmet" apps/api/package.json; then
    echo -e "${GREEN}✅ Helmet.js installed${NC}"
else
    echo -e "${RED}❌ Helmet.js not installed${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

echo ""

# ============================================================================
# 5. Check CORS configuration
# ============================================================================
echo "5️⃣  Checking CORS configuration..."

if grep -q "cors" apps/api/package.json; then
    echo -e "${GREEN}✅ CORS package installed${NC}"

    # Check if CORS is properly configured (not allowing all origins in production)
    if grep -r "origin:.*\*" apps/api/src --include="*.ts" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  CORS allows all origins - review for production${NC}"
    fi
else
    echo -e "${RED}❌ CORS not configured${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

echo ""

# ============================================================================
# 6. Check for debug code
# ============================================================================
echo "6️⃣  Checking for debug code..."

if grep -r "console.log" apps/api/src --include="*.ts" 2>/dev/null | grep -v "logger" | head -5; then
    echo -e "${YELLOW}⚠️  Found console.log statements - should use logger${NC}"
else
    echo -e "${GREEN}✅ No console.log found${NC}"
fi

echo ""

# ============================================================================
# 7. Check file permissions
# ============================================================================
echo "7️⃣  Checking file permissions..."

if [ -f .env ]; then
    PERMS=$(stat -c "%a" .env 2>/dev/null || stat -f "%A" .env 2>/dev/null)
    if [ "$PERMS" != "600" ] && [ "$PERMS" != "400" ]; then
        echo -e "${YELLOW}⚠️  .env file permissions: $PERMS (should be 600 or 400)${NC}"
    else
        echo -e "${GREEN}✅ .env file permissions correct${NC}"
    fi
fi

echo ""

# ============================================================================
# 8. Check for TODO security items
# ============================================================================
echo "8️⃣  Checking for TODO security items..."

TODO_COUNT=$(grep -r "TODO.*security\|TODO.*auth\|TODO.*encrypt" apps/ --include="*.ts" --include="*.js" 2>/dev/null | wc -l)

if [ "$TODO_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found $TODO_COUNT security-related TODOs${NC}"
    grep -r "TODO.*security\|TODO.*auth\|TODO.*encrypt" apps/ --include="*.ts" --include="*.js" 2>/dev/null | head -5
else
    echo -e "${GREEN}✅ No security TODOs found${NC}"
fi

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "========================"
echo "📊 Audit Summary"
echo "========================"

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ No critical issues found${NC}"
    echo ""
    echo "Security status: GOOD"
    exit 0
else
    echo -e "${RED}❌ Found $ISSUES_FOUND issue(s)${NC}"
    echo ""
    echo "Security status: NEEDS ATTENTION"
    echo ""
    echo "Recommendations:"
    echo "1. Fix critical and high vulnerabilities: npm audit fix"
    echo "2. Remove any exposed secrets from code"
    echo "3. Review CORS configuration for production"
    echo "4. Replace console.log with proper logger"
    echo "5. Address security TODOs"
    exit 1
fi
