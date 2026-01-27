#!/bin/bash

# ==============================================================================
# NetManager Performance Check Script (Optimized)
# ==============================================================================
# Jalankan di server production: ./check-performance.sh
# ==============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║         NETMANAGER PERFORMANCE CHECK                         ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. CONTAINER STATUS
echo -e "${BOLD}${BLUE}📦 [1/5] CONTAINER STATUS${NC}"
echo "─────────────────────────────────────────────────────────────"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "NAMES|netmanager" || echo "No containers"
echo ""

# 2. RESOURCE USAGE
echo -e "${BOLD}${BLUE}📊 [2/5] RESOURCE USAGE${NC}"
echo "─────────────────────────────────────────────────────────────"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" | grep -E "NAME|netmanager"
echo ""

# 3. DISK (Host only - fast)
echo -e "${BOLD}${BLUE}💾 [3/5] HOST DISK${NC}"
echo "─────────────────────────────────────────────────────────────"
df -h / | awk 'NR==1 || /\/$/'
echo ""

# 4. DATABASE (with timeout)
echo -e "${BOLD}${BLUE}🗄️  [4/5] DATABASE${NC}"
echo "─────────────────────────────────────────────────────────────"
echo -n "PostgreSQL connections: "
timeout 5 docker exec netmanager-db psql -U netmgr -d netmanager -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | tr -d ' ' || echo "timeout/error"

echo -n "PostgreSQL size: "
timeout 5 docker exec netmanager-db psql -U netmgr -d netmanager -t -c "SELECT pg_size_pretty(pg_database_size('netmanager'));" 2>/dev/null | tr -d ' ' || echo "timeout/error"
echo ""

# 5. HEALTH CHECK
echo -e "${BOLD}${BLUE}❤️  [5/5] APP HEALTH${NC}"
echo "─────────────────────────────────────────────────────────────"
HEALTH=$(timeout 5 docker exec netmanager-app wget -qO- http://127.0.0.1:3000/api/health 2>/dev/null || echo "timeout")
if echo "$HEALTH" | grep -q "healthy\|ok"; then
    echo -e "Status: ${GREEN}✅ HEALTHY${NC}"
else
    echo -e "Status: ${YELLOW}⚠️  $HEALTH${NC}"
fi
echo ""

# SUMMARY
echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}                    ✅ CHECK COMPLETED                        ${NC}"
echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo ""
