#!/bin/bash

# Script untuk cek data ONU di database
# Menampilkan sample data untuk verifikasi

echo "==================================="
echo "Checking ONU Data in Database..."
echo "==================================="
echo ""

# Check apakah ada data ONU
echo "📊 Total ONU in database:"
docker exec netmanager-postgres psql -U netmgr -d netmanager -c "SELECT COUNT(*) FROM \"Onu\";"
echo ""

# Check sample data dengan field baru
echo "🔍 Sample ONU data (with Basic Info fields):"
docker exec netmanager-postgres psql -U netmgr -d netmanager -c "SELECT name, \"gponOnu\", status, \"serialNumber\", \"registrationMode\", \"softwareVersion\", \"hardwareVersion\", temperature, \"laserBiasCurrent\" FROM \"Onu\" LIMIT 5;"
echo ""

# Check berapa ONU yang punya Basic Info
echo "✅ ONUs with Basic Info populated:"
docker exec netmanager-postgres psql -U netmgr -d netmanager -c "SELECT COUNT(*) as total_with_basic_info FROM \"Onu\" WHERE \"registrationMode\" IS NOT NULL OR \"softwareVersion\" IS NOT NULL OR \"hardwareVersion\" IS NOT NULL OR temperature IS NOT NULL OR \"laserBiasCurrent\" IS NOT NULL;"
echo ""

# Check ONU yang belum punya Basic Info
echo "❌ ONUs without Basic Info:"
docker exec netmanager-postgres psql -U netmgr -d netmanager -c "SELECT COUNT(*) as total_without_basic_info FROM \"Onu\" WHERE \"registrationMode\" IS NULL AND \"softwareVersion\" IS NULL AND \"hardwareVersion\" IS NULL AND temperature IS NULL AND \"laserBiasCurrent\" IS NULL;"
echo ""

echo "==================================="
echo "Done!"
echo "==================================="

