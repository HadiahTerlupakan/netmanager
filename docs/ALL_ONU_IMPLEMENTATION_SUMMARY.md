# 📊 Ringkasan Implementasi Menu All ONU - ZTE-AN-PON-MIB

**Status**: ✅ **SCHEMA & OID COMPLETE** | 🔄 **PARSER PENDING**

**Tanggal**: 15 November 2024

---

## ✅ Yang Sudah Selesai

### 1. Database Schema Update (`prisma/schema.prisma`)

Telah ditambahkan 15 field baru ke model `Onu`:

```prisma
// New fields from ZTE-AN-PON-MIB (OID: 1.3.6.1.4.1.3902.1082.50.10.2.2)
vendorId              String?   // ONU vendor ID
equipmentId           String?   // ONU equipment ID
firmwareVersion       String?   // Firmware version
macAddress            String?   // ONU MAC address
batteryStatus         String?   // Battery status
opticalTransceiverType String?  // Optical transceiver type
lastDeregTime         DateTime? // Last deregistration time
authMode              String?   // Authentication mode
loid                  String?   // Logical ONU ID
password              String?   // ONU password

// ONU Status fields (OID: 1.3.6.1.4.1.3902.1082.50.10.2.3)
configState           String?   // Configuration state
powerLevel            String?   // Power level
dyingGaspTime         DateTime? // Dying gasp time

// Optical power status (OID: 1.3.6.1.4.1.3902.1082.50.10.2.28)
rxPowerStatus         String?   // RX power status
txPowerStatus         String?   // TX power status
```

### 2. Migration Database

Migration berhasil dibuat dan diapply:
- ✅ Migration ID: `20251115154028_add_zte_an_pon_onu_fields`
- ✅ 15 kolom baru berhasil ditambahkan
- ✅ 2 index baru ditambahkan (`serialNumber`, `macAddress`)

### 3. SNMP OIDs Definition

Telah ditambahkan konstanta `SNMP_ZTE_AN_PON_OIDS` di `app/api/olts/onus/route.ts` dengan struktur lengkap:

```typescript
const SNMP_ZTE_AN_PON_OIDS = {
  baseOid: '1.3.6.1.4.1.3902.1082.50.10',
  ponPort: { ... },      // PON Port Management
  onuInfo: { ... },      // ONU Information (22 fields)
  onuStatus: { ... },    // ONU Status (7 fields)
  unconfOnu: { ... },    // Unconfigured ONU (14 fields)
  onuOpticalPower: { ... }, // Optical Power (4 fields)
  oltRxPower: { ... },   // OLT RX Power (2 fields)
  opticalModule: { ... }, // Optical Module (10 fields)
  onuPerfStats: { ... }, // Performance Statistics (9 fields)
}
```

### 4. Dokumentasi

Telah dibuat 2 file dokumentasi:
- ✅ `docs/ZTE_AN_PON_MIB_IMPLEMENTATION.md` - Dokumentasi teknis implementasi
- ✅ `docs/ALL_ONU_IMPLEMENTATION_SUMMARY.md` - Ringkasan implementasi (file ini)

---

## 🔄 Yang Perlu Diselesaikan

### 1. Implementasi Parser Function

Perlu membuat function baru `getZteAnPonOnuDataViaSNMP()` di `app/api/olts/onus/route.ts`:

```typescript
export async function getZteAnPonOnuDataViaSNMP(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oltName: string,
  oltId: string
): Promise<Array<{...}>> {
  // Implementation menggunakan SNMP_ZTE_AN_PON_OIDS
  // Steps:
  // 1. Walk ONU Information OIDs (.1082.50.10.2.2)
  // 2. Walk ONU Status OIDs (.1082.50.10.2.3)
  // 3. Walk Optical Power OIDs (.1082.50.10.2.28)
  // 4. Parse dan combine data
  // 5. Return array of ONU objects
}
```

**Langkah Implementasi Parser:**

1. **Walk ONU Info Table** (`.1082.50.10.2.2`):
   ```typescript
   const infoResults = await Promise.all([
     snmpWalk(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuInfo.serialNumber, 30000),
     snmpWalk(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuInfo.macAddress, 30000),
     snmpWalk(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuInfo.vendorId, 30000),
     snmpWalk(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuInfo.equipmentId, 30000),
     // ... dst
   ])
   ```

2. **Walk ONU Status Table** (`.1082.50.10.2.3`):
   ```typescript
   const statusResults = await Promise.all([
     snmpWalk(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuStatus.state, 30000),
     snmpWalk(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuStatus.configState, 30000),
     snmpWalk(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuStatus.powerLevel, 30000),
     // ... dst
   ])
   ```

3. **Walk Optical Power Table** (`.1082.50.10.2.28`):
   ```typescript
   const opticalResults = await Promise.all([
     snmpWalk(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuOpticalPower.rxPower, 30000),
     snmpWalk(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuOpticalPower.txPower, 30000),
     snmpWalk(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuOpticalPower.rxPowerStatus, 30000),
     snmpWalk(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuOpticalPower.txPowerStatus, 30000),
   ])
   ```

4. **Parse Index** - Index untuk ONU adalah `{zxAnPonIfIndex, zxAnOnuId}`:
   ```typescript
   function parseZteAnPonIndex(oid: string, baseOid: string): { ifIndex: number; onuId: number } | null {
     const suffix = oid.substring(baseOid.length + 1)
     const parts = suffix.split('.')
     if (parts.length < 2) return null
     
     return {
       ifIndex: parseInt(parts[0]),
       onuId: parseInt(parts[1]),
     }
   }
   ```

5. **Combine Data**:
   ```typescript
   const onuMap = new Map<string, any>()
   
   // Untuk setiap hasil SNMP, parse index dan simpan ke map
   for (const result of infoResults[0]) { // serialNumber
     const index = parseZteAnPonIndex(result.oid, SNMP_ZTE_AN_PON_OIDS.onuInfo.serialNumber)
     if (!index) continue
     
     const key = `${index.ifIndex}-${index.onuId}`
     if (!onuMap.has(key)) {
       onuMap.set(key, {
         ifIndex: index.ifIndex,
         onuId: index.onuId,
         gponOnu: `${convertIfIndexToPort(index.ifIndex)}:${index.onuId}`,
       })
     }
     onuMap.get(key)!.serialNumber = result.value?.toString() || ''
   }
   
   // ... ulangi untuk field lainnya
   ```

### 2. Update Auto-Detection Logic

Update `GET` handler di `app/api/olts/onus/route.ts` untuk mencoba parser baru:

```typescript
// Priority order for trying parsers
// 1. Try ZTE-AN-PON-MIB (.1082.50.10) - Paling lengkap, terbaru
console.log(`[All-ONU] Trying ZTE-AN-PON-MIB parser (.1082.50.10)...`)
let onus = await getZteAnPonOnuDataViaSNMP(
  olt.ipAddress,
  olt.snmpPort,
  olt.snmpCommunityWrite,
  olt.snmpVersion,
  olt.name,
  olt.id
)

// 2. Try C300 GPON parser (.1012) - Fallback
if (onus.length === 0) {
  console.log(`[All-ONU] ZTE-AN-PON-MIB parser returned no data, trying C300 GPON parser (.1012)...`)
  onus = await getC300GponOnuDataViaSNMP(...)
}

// 3. Try C3XX parser (.1082.500) - Fallback untuk C3XX
if (onus.length === 0) {
  console.log(`[All-ONU] C300 GPON parser returned no data, trying C3XX parser (.1082.500)...`)
  onus = await getC3xxOnuDataViaSNMP(...)
}

// 4. Try standard parser - Fallback terakhir
if (onus.length === 0) {
  console.log(`[All-ONU] C3XX parser returned no data, trying standard parser...`)
  onus = await getOnuDataViaSNMP(...)
}
```

### 3. Update OnuRepository

Update `lib/repositories/OnuRepository.ts` untuk support field baru dalam method `upsert`:

```typescript
async upsert(oltId: string, gponOnu: string, data: {
  // ... existing fields ...
  
  // New ZTE-AN-PON-MIB fields
  vendorId?: string | null
  equipmentId?: string | null
  firmwareVersion?: string | null
  macAddress?: string | null
  batteryStatus?: string | null
  opticalTransceiverType?: string | null
  lastDeregTime?: Date | null
  authMode?: string | null
  loid?: string | null
  password?: string | null
  configState?: string | null
  powerLevel?: string | null
  dyingGaspTime?: Date | null
  rxPowerStatus?: string | null
  txPowerStatus?: string | null
}): Promise<Onu> {
  // Implementation
}
```

### 4. Update UI (Optional - Enhancement)

Update `app/admin/network/onu/page.tsx` untuk menampilkan field baru:

**Field yang bisa ditampilkan:**
- ✅ Vendor ID (di kolom info)
- ✅ Equipment ID (di kolom info)  
- ✅ MAC Address (kolom baru)
- ✅ Firmware Version (di tooltip atau expand row)
- ✅ Battery Status (icon di kolom status)
- ✅ Auth Mode (di tooltip)
- ✅ LOID (di expand row)
- ✅ Config State (di tooltip)
- ✅ Power Level (di kolom optical power)
- ✅ RX/TX Power Status (indicator color)

---

## 📋 Checklist Implementasi

### Phase 1: Core Implementation (Priority Tinggi)
- [x] Update schema dengan field baru
- [x] Generate migration database
- [x] Tambahkan SNMP OID constants
- [ ] Implementasi `getZteAnPonOnuDataViaSNMP()` function
- [ ] Implementasi `parseZteAnPonIndex()` helper function
- [ ] Update auto-detection logic di GET handler

### Phase 2: Integration & Testing
- [ ] Update `OnuRepository.ts` untuk support field baru
- [ ] Test parser dengan real OLT
- [ ] Verify data di database
- [ ] Test pagination dengan field baru

### Phase 3: UI Enhancement (Optional)
- [ ] Tambahkan kolom baru di tabel ONU
- [ ] Implementasi expand row untuk detail info
- [ ] Tambahkan filter berdasarkan vendor
- [ ] Tambahkan filter berdasarkan auth mode
- [ ] Implementasi export dengan field lengkap

---

## 🔧 Command untuk Testing

### 1. Test SNMP Walk untuk ONU Info

```bash
# Test Serial Number
snmpwalk -v2c -c public <OLT_IP> 1.3.6.1.4.1.3902.1082.50.10.2.2.1.7

# Test MAC Address
snmpwalk -v2c -c public <OLT_IP> 1.3.6.1.4.1.3902.1082.50.10.2.2.1.5

# Test Vendor ID
snmpwalk -v2c -c public <OLT_IP> 1.3.6.1.4.1.3902.1082.50.10.2.2.1.8

# Test Equipment ID
snmpwalk -v2c -c public <OLT_IP> 1.3.6.1.4.1.3902.1082.50.10.2.2.1.9
```

### 2. Test SNMP Walk untuk ONU Status

```bash
# Test State
snmpwalk -v2c -c public <OLT_IP> 1.3.6.1.4.1.3902.1082.50.10.2.3.1.1

# Test Config State
snmpwalk -v2c -c public <OLT_IP> 1.3.6.1.4.1.3902.1082.50.10.2.3.1.2

# Test Power Level
snmpwalk -v2c -c public <OLT_IP> 1.3.6.1.4.1.3902.1082.50.10.2.3.1.3
```

### 3. Test SNMP Walk untuk Optical Power

```bash
# Test RX Power
snmpwalk -v2c -c public <OLT_IP> 1.3.6.1.4.1.3902.1082.50.10.2.28.1.1

# Test TX Power
snmpwalk -v2c -c public <OLT_IP> 1.3.6.1.4.1.3902.1082.50.10.2.28.1.3

# Test RX Power Status
snmpwalk -v2c -c public <OLT_IP> 1.3.6.1.4.1.3902.1082.50.10.2.28.1.2

# Test TX Power Status
snmpwalk -v2c -c public <OLT_IP> 1.3.6.1.4.1.3902.1082.50.10.2.28.1.4
```

### 4. Check Database

```bash
# Check schema
docker exec netmanager-postgres psql -U netmgr -d netmanager -c "\d \"Onu\""

# Count ONUs with new fields
docker exec netmanager-postgres psql -U netmgr -d netmanager -c "SELECT COUNT(*) FROM \"Onu\" WHERE \"vendorId\" IS NOT NULL;"

# Sample data
docker exec netmanager-postgres psql -U netmgr -d netmanager -c "SELECT \"gponOnu\", \"vendorId\", \"equipmentId\", \"macAddress\", \"firmwareVersion\" FROM \"Onu\" LIMIT 10;"
```

---

## 📚 Referensi

### Dokumentasi
- **GPON MIB Specifications** - User-provided documentation
- **ZTE-AN-PON-MIB** - Base OID: `.1.3.6.1.4.1.3902.1082.50.10`
- **[ZTE_AN_PON_MIB_IMPLEMENTATION.md](./ZTE_AN_PON_MIB_IMPLEMENTATION.md)** - Dokumentasi teknis lengkap

### Files Modified
- `prisma/schema.prisma` - Model Onu updated
- `app/api/olts/onus/route.ts` - SNMP OIDs added
- `prisma/migrations/20251115154028_add_zte_an_pon_onu_fields/migration.sql` - Migration file

### Files to Modify (Next Steps)
- `app/api/olts/onus/route.ts` - Implementasi parser baru
- `lib/repositories/OnuRepository.ts` - Update upsert method
- `app/admin/network/onu/page.tsx` - UI enhancement (optional)

---

## 🎯 Next Action Items

**Untuk Developer:**

1. **Implementasi Parser** (Estimated: 2-3 hours)
   - Buat function `getZteAnPonOnuDataViaSNMP()`
   - Implementasi SNMP walk untuk semua OID
   - Parse dan combine data

2. **Testing** (Estimated: 1 hour)
   - Test dengan real OLT
   - Verify data accuracy
   - Check performance

3. **Documentation** (Estimated: 30 minutes)
   - Update dokumentasi dengan hasil testing
   - Tambahkan contoh response
   - Update troubleshooting guide

**Total Estimated Time: 3.5-4.5 hours**

---

**Last Updated**: 15 November 2024

**Status**: ✅ Foundation Complete | 🔄 Parser Implementation Pending

