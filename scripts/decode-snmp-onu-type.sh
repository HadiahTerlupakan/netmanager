#!/bin/bash

# Script untuk decode SNMP output dan mendapatkan ONU Type dari OLT ZTE
# Usage: ./decode-snmp-onu-type.sh <OLT_IP> <SNMP_PORT> <COMMUNITY>

OLT_IP=${1:-"113.192.1.98"}
SNMP_PORT=${2:-"23161"}
COMMUNITY=${3:-"public"}

echo "=========================================="
echo "SNMP ONU Type Decoder for ZTE OLT"
echo "=========================================="
echo "OLT IP: $OLT_IP"
echo "SNMP Port: $SNMP_PORT"
echo "Community: $COMMUNITY"
echo ""

# Function untuk decode composite index
decode_index() {
    local n=$1
    local hx=$(printf '%08x' "$n")
    
    # Parse bytes: [Type(4bit)][Shelf(4bit)][Slot(8bit)][Port(8bit)][0x00]
    local type=$((0x${hx:0:1}))
    local shelf=$((0x${hx:1:1}))
    local slot=$((0x${hx:2:2}))
    local port=$((0x${hx:4:2}))
    
    printf "Index: %d (hex: 0x%s) -> Type=%d Shelf=%d Slot=%d Port=%d\n" "$n" "$hx" "$type" "$shelf" "$slot" "$port"
}

echo "1. Walking ONU Device Management Table (zxGponOntDevMgmtTable)..."
echo "   OID: 1.3.6.1.4.1.3902.1012.3.28.1"
echo ""
snmpwalk -v2c -c "$COMMUNITY" "$OLT_IP:$SNMP_PORT" 1.3.6.1.4.1.3902.1012.3.28.1 2>/dev/null | head -20

echo ""
echo "2. Walking ONU Type OID (zxGponOntDevMgmtTypeName)..."
echo "   OID: 1.3.6.1.4.1.3902.1012.3.28.1.1.1"
echo ""
snmpwalk -v2c -c "$COMMUNITY" "$OLT_IP:$SNMP_PORT" 1.3.6.1.4.1.3902.1012.3.28.1.1.1 2>/dev/null | head -20

echo ""
echo "3. Walking ONU Type from registered ONUs..."
echo "   OID: 1.3.6.1.4.1.3902.1012.3.28.2.1.8"
echo ""
snmpwalk -v2c -c "$COMMUNITY" "$OLT_IP:$SNMP_PORT" 1.3.6.1.4.1.3902.1012.3.28.2.1.8 2>/dev/null | head -20

echo ""
echo "4. Decoding composite indexes from output..."
echo "   Extracting indexes and converting to slot/port..."
echo ""

# Extract indexes dari output dan decode
for index in 268632320 268632576 268632832 268633088 268633344 268633600 268634368 268635648; do
    decode_index "$index"
done

echo ""
echo "5. Trying to get ONU Type names..."
echo "   Extracting ONU Type values from SNMP walk..."
echo ""

# Coba ambil ONU Type dari beberapa OID
echo "From OID 1.3.6.1.4.1.3902.1012.3.28.2.1.8:"
snmpwalk -v2c -c "$COMMUNITY" "$OLT_IP:$SNMP_PORT" 1.3.6.1.4.1.3902.1012.3.28.2.1.8 2>/dev/null | \
    grep -E "STRING|OCTET" | \
    sed 's/.*= \(.*\): \(.*\)/\2/' | \
    sort -u | head -10

echo ""
echo "From OID 1.3.6.1.4.1.3902.1012.3.28.1.1.1:"
snmpwalk -v2c -c "$COMMUNITY" "$OLT_IP:$SNMP_PORT" 1.3.6.1.4.1.3902.1012.3.28.1.1.1 2>/dev/null | \
    grep -E "STRING|OCTET" | \
    sed 's/.*= \(.*\): \(.*\)/\2/' | \
    sort -u | head -10

echo ""
echo "=========================================="
echo "Done!"
echo "=========================================="

