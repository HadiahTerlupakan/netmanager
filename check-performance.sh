#!/bin/bash

# ==============================================================================
# NetManager Performance Check Script
# ==============================================================================
# Jalankan di server production: ./check-performance.sh
# ==============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║         NETMANAGER PERFORMANCE CHECK                         ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ==============================================================================
# 1. CONTAINER STATUS
# ==============================================================================
echo -e "${BOLD}${BLUE}📦 [1/6] CONTAINER STATUS${NC}"
echo "─────────────────────────────────────────────────────────────"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep netmanager || echo "No containers found"
echo ""

# ==============================================================================
# 2. RESOURCE USAGE (CPU, Memory)
# ==============================================================================
echo -e "${BOLD}${BLUE}📊 [2/6] RESOURCE USAGE${NC}"
echo "─────────────────────────────────────────────────────────────"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" | grep -E "NAME|netmanager"
echo ""

# ==============================================================================
# 3. DISK USAGE
# ==============================================================================
echo -e "${BOLD}${BLUE}💾 [3/6] DISK USAGE${NC}"
echo "─────────────────────────────────────────────────────────────"
echo "Docker disk usage:"
docker system df 2>/dev/null || echo "Cannot get docker disk info"
echo ""
echo "Host disk:"
df -h / | tail -1
echo ""

# ==============================================================================
# 4. DATABASE STATUS
# ==============================================================================
echo -e "${BOLD}${BLUE}🗄️  [4/6] DATABASE STATUS${NC}"
echo "─────────────────────────────────────────────────────────────"

# Get Redis password from .env if exists
REDIS_PASS=""
if [ -f ".env" ]; then
    REDIS_PASS=$(grep "REDIS_PASSWORD=" .env | cut -d'=' -f2 | tr -d '"' | tr -d "'")
fi

echo "PostgreSQL:"
echo "  - Active connections: $(docker exec netmanager-db psql -U netmgr -d netmanager -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | tr -d ' ' || echo "N/A")"
echo "  - Database size: $(docker exec netmanager-db psql -U netmgr -d netmanager -t -c "SELECT pg_size_pretty(pg_database_size('netmanager'));" 2>/dev/null | tr -d ' ' || echo "N/A")"
echo ""

echo "Redis:"
if [ -n "$REDIS_PASS" ]; then
    echo "  - Memory used: $(docker exec netmanager-redis redis-cli -a "$REDIS_PASS" INFO memory 2>/dev/null | grep "used_memory_human" | cut -d: -f2 | tr -d '\r' || echo "N/A")"
    echo "  - Keys count: $(docker exec netmanager-redis redis-cli -a "$REDIS_PASS" DBSIZE 2>/dev/null | tr -d '\r' || echo "N/A")"
else
    echo "  - Cannot read (REDIS_PASSWORD not found in .env)"
fi
echo ""

# ==============================================================================
# 5. APPLICATION HEALTH
# ==============================================================================
echo -e "${BOLD}${BLUE}❤️  [5/6] APPLICATION HEALTH${NC}"
echo "─────────────────────────────────────────────────────────────"

# Health check via internal network
HEALTH_RESPONSE=$(docker exec netmanager-app wget -qO- http://127.0.0.1:3000/api/health 2>/dev/null || echo '{"status":"error"}')
echo "Health endpoint: $HEALTH_RESPONSE"
echo ""

# Check if app is responding
APP_STATUS=$(echo "$HEALTH_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$APP_STATUS" = "healthy" ] || [ "$APP_STATUS" = "ok" ]; then
    echo -e "  Status: ${GREEN}✅ HEALTHY${NC}"
else
    echo -e "  Status: ${RED}❌ UNHEALTHY${NC}"
fi
echo ""

# ==============================================================================
# 6. RECENT ERRORS (Last 10 lines with ERROR)
# ==============================================================================
echo -e "${BOLD}${BLUE}⚠️  [6/6] RECENT ERRORS (last 10)${NC}"
echo "─────────────────────────────────────────────────────────────"
docker logs netmanager-app --tail 500 2>&1 | grep -i "error\|fail\|exception" | tail -10 || echo "No recent errors found ✅"
echo ""

# ==============================================================================
# 7. API RESPONSE TIME TEST
# ==============================================================================
echo -e "${BOLD}${BLUE}⏱️  [BONUS] API RESPONSE TIME TEST${NC}"
echo "─────────────────────────────────────────────────────────────"
echo "Testing /api/health response time..."

# Test 3 times and show results
for i in 1 2 3; do
    START=$(date +%s%N)
    docker exec netmanager-app wget -qO- http://127.0.0.1:3000/api/health > /dev/null 2>&1
    END=$(date +%s%N)
    DIFF=$(( (END - START) / 1000000 ))
    
    if [ $DIFF -lt 100 ]; then
        echo -e "  Test $i: ${GREEN}${DIFF}ms${NC} (Fast)"
    elif [ $DIFF -lt 500 ]; then
        echo -e "  Test $i: ${YELLOW}${DIFF}ms${NC} (Normal)"
    else
        echo -e "  Test $i: ${RED}${DIFF}ms${NC} (Slow)"
    fi
done
echo ""

# ==============================================================================
# SUMMARY
# ==============================================================================
echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}                    CHECK COMPLETED                           ${NC}"
echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo ""
