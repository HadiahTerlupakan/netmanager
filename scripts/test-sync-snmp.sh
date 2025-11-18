#!/bin/bash

# Script untuk test sync SNMP langsung via API
# Pastikan aplikasi Next.js sedang running

echo "========================================"
echo "Testing SNMP Sync via API..."
echo "========================================"
echo ""

echo "📡 Checking if app is running..."
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ App is running on localhost:3000"
else
    echo "❌ App is NOT running! Please start with: npm run dev"
    exit 1
fi

echo ""
echo "🔄 Triggering SNMP sync (with refresh=true)..."
echo "This may take 2-5 minutes depending on ONU count..."
echo ""

# Call API with refresh=true to force SNMP fetch
# Limit to 10 for faster testing
curl -s "http://localhost:3000/api/olts/onus?refresh=true&limit=10" \
  -H "Cookie: $(cat ~/.netmanager-cookie 2>/dev/null || echo '')" \
  | jq '.'

echo ""
echo "========================================"
echo "✅ Sync completed!"
echo "========================================"
echo ""
echo "Now checking database..."
echo ""

# Check if data updated
docker exec netmanager-postgres psql -U netmgr -d netmanager -c "SELECT COUNT(*) as with_rx FROM \"Onu\" WHERE \"rxOlt\" IS NOT NULL AND \"rxOlt\" != '';"

echo ""
echo "📊 Sample data after sync:"
docker exec netmanager-postgres psql -U netmgr -d netmanager -c "SELECT name, \"gponOnu\", \"rxOlt\", \"registrationMode\", temperature FROM \"Onu\" LIMIT 3;"

echo ""
echo "Done!"





