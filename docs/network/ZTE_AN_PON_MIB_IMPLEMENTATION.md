# Implementasi ZTE-AN-PON-MIB untuk Menu All ONU

**Status**: ✅ **COMPLETED - Field Schema Updated & SNMP OIDs Added**

**Tanggal**: 15 November 2024

---

## 📋 Overview

Dokumen ini menjelaskan implementasi lengkap OID SNMP dari dokumentasi **GPON MIB Specifications** (ZTE-AN-PON-MIB) untuk menu **All ONU** di aplikasi NetManager.

Base OID: `.1.3.6.1.4.1.3902.1082.50.10` (Public PON Management)

---

## 🆕 Field Baru yang Ditambahkan

### 1. ONU Information Fields (dari `.1082.50.10.2.2`)

| Field | Type | OID | Description |
|-------|------|-----|-------------|
| `vendorId` | String? | `.2.2.1.8` | Vendor ID ONU (ZTEG, HWTC, dll) |
| `equipmentId` | String? | `.2.2.1.9` | Equipment/Model ID |
| `firmwareVersion` | String? | `.2.2.1.13` | Firmware version |
| `macAddress` | String? | `.2.2.1.5` | MAC address ONU |
| `batteryStatus` | String? | `.2.2.1.14` | Status baterai (jika ada) |
| `opticalTransceiverType` | String? | `.2.2.1.15` | Tipe optical transceiver |
| `lastDeregTime` | DateTime? | `.2.2.1.4` | Waktu terakhir deregistrasi |
| `authMode` | String? | `.2.2.1.20` | Mode autentikasi |
| `loid` | String? | `.2.2.1.17` | Logical ONU ID |
| `password` | String? | `.2.2.1.16` | Password ONU |

### 2. ONU Status Fields (dari `.1082.50.10.2.3`)

| Field | Type | OID | Description |
|-------|------|-----|-------------|
| `configState` | String? | `.2.3.1.2` | Status konfigurasi ONU |
| `powerLevel` | String? | `.2.3.1.3` | Power level |
| `dyingGaspTime` | DateTime? | `.2.3.1.4` | Waktu terakhir dying gasp |

### 3. Optical Power Status Fields (dari `.1082.50.10.2.28`)

| Field | Type | OID | Description |
|-------|------|-----|-------------|
| `rxPowerStatus` | String? | `.2.28.1.2` | Status RX power (normal/warning/critical) |
| `txPowerStatus` | String? | `.2.28.1.4` | Status TX power (normal/warning/critical) |

---

## 🔧 Perubahan pada Database Schema

### Migration SQL yang Perlu Dijalankan

```sql
-- Add new ONU fields from ZTE-AN-PON-MIB
ALTER TABLE "Onu" ADD COLUMN "vendorId" TEXT;
ALTER TABLE "Onu" ADD COLUMN "equipmentId" TEXT;
ALTER TABLE "Onu" ADD COLUMN "firmwareVersion" TEXT;
ALTER TABLE "Onu" ADD COLUMN "macAddress" TEXT;
ALTER TABLE "Onu" ADD COLUMN "batteryStatus" TEXT;
ALTER TABLE "Onu" ADD COLUMN "opticalTransceiverType" TEXT;
ALTER TABLE "Onu" ADD COLUMN "lastDeregTime" TIMESTAMP(3);
ALTER TABLE "Onu" ADD COLUMN "authMode" TEXT;
ALTER TABLE "Onu" ADD COLUMN "loid" TEXT;
ALTER TABLE "Onu" ADD COLUMN "password" TEXT;
ALTER TABLE "Onu" ADD COLUMN "configState" TEXT;
ALTER TABLE "Onu" ADD COLUMN "powerLevel" TEXT;
ALTER TABLE "Onu" ADD COLUMN "dyingGaspTime" TIMESTAMP(3);
ALTER TABLE "Onu" ADD COLUMN "rxPowerStatus" TEXT;
ALTER TABLE "Onu" ADD COLUMN "txPowerStatus" TEXT;

-- Add indexes for better query performance
CREATE INDEX "Onu_serialNumber_idx" ON "Onu"("serialNumber");
CREATE INDEX "Onu_macAddress_idx" ON "Onu"("macAddress");
```

---

## 📡 SNMP OIDs yang Diimplementasikan

### PON Port Management (`.1082.50.10.2.1`)

```typescript
ponPort: {
  adminStatus: '1.3.6.1.4.1.3902.1082.50.10.2.1.1.1',
  operStatus: '1.3.6.1.4.1.3902.1082.50.10.2.1.1.2',
  type: '1.3.6.1.4.1.3902.1082.50.10.2.1.1.3',
  opticalModuleStatus: '1.3.6.1.4.1.3902.1082.50.10.2.1.1.4',
  laserState: '1.3.6.1.4.1.3902.1082.50.10.2.1.1.5',
  serialNumber: '1.3.6.1.4.1.3902.1082.50.10.2.1.1.6',
  vendorId: '1.3.6.1.4.1.3902.1082.50.10.2.1.1.7',
  ponId: '1.3.6.1.4.1.3902.1082.50.10.2.1.1.8',
  fecMode: '1.3.6.1.4.1.3902.1082.50.10.2.1.1.9',
}
```

### ONU Information (`.1082.50.10.2.2`)

Index: `{zxAnPonIfIndex, zxAnOnuId}`

```typescript
onuInfo: {
  adminStatus: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.1',
  operStatus: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.2',
  lastRegTime: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.3',
  lastDeregTime: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.4',
  macAddress: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.5',
  logicalDistance: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.6',
  serialNumber: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.7',
  vendorId: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.8',
  equipmentId: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.9',
  mainSoftwareVersion: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.10',
  softwareVersion: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.11',
  hardwareVersion: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.12',
  firmwareVersion: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.13',
  batteryStatus: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.14',
  opticalTransceiverType: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.15',
  password: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.16',
  loid: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.17',
  authMode: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.20',
}
```

### ONU Status (`.1082.50.10.2.3`)

```typescript
onuStatus: {
  state: '1.3.6.1.4.1.3902.1082.50.10.2.3.1.1',
  configState: '1.3.6.1.4.1.3902.1082.50.10.2.3.1.2',
  powerLevel: '1.3.6.1.4.1.3902.1082.50.10.2.3.1.3',
  dyingGaspTime: '1.3.6.1.4.1.3902.1082.50.10.2.3.1.4',
  signalDegrade: '1.3.6.1.4.1.3902.1082.50.10.2.3.1.5',
  signalFail: '1.3.6.1.4.1.3902.1082.50.10.2.3.1.6',
  losStatus: '1.3.6.1.4.1.3902.1082.50.10.2.3.1.7',
}
```

### Optical Power (`.1082.50.10.2.28`)

```typescript
onuOpticalPower: {
  rxPower: '1.3.6.1.4.1.3902.1082.50.10.2.28.1.1',
  rxPowerStatus: '1.3.6.1.4.1.3902.1082.50.10.2.28.1.2',
  txPower: '1.3.6.1.4.1.3902.1082.50.10.2.28.1.3',
  txPowerStatus: '1.3.6.1.4.1.3902.1082.50.10.2.28.1.4',
}
```

### Unconfigured ONU (`.1082.50.10.2.10`)

```typescript
unconfOnu: {
  ifIndex: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.1',
  onuId: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.2',
  serialNumber: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.3',
  password: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.4',
  loid: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.5',
  vendorId: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.6',
  equipmentId: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.7',
  firmwareVersion: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.8',
  softwareVersion: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.9',
  hardwareVersion: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.10',
  logicalDistance: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.11',
  opticalTransceiverType: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.12',
  macAddress: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.13',
  regTime: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.14',
}
```

---

## 🔄 Composite Index

Berdasarkan dokumentasi, index yang digunakan:

### IfIndex for GPON (Type 1)

```
(MSB) Type(4bits) 4bits 8bits 8bits 8bits (LSB)
      1          rack  shelf slot  port
```

### ZxAnSubIfIndex for GPON ONU (Type 1)

```
(MSB) Type(5bits) 11bits 16bits (LSB)
      1          ONT ID  0
```

---

## 📊 Mapping Status Values

### ONU Admin Status
- 1: Up
- 2: Down
- 3: Testing

### ONU Oper Status
- 1: Up/Online
- 2: Down/Offline
- 3: Testing
- 4: Unknown
- 5: Dormant
- 6: NotPresent
- 7: LowerLayerDown

### Auth Mode Values
- 1: SN (Serial Number)
- 2: Password
- 3: SN+Password
- 4: RegisterId
- 5: RegisterId+8021x
- 6: RegisterId+Mutual
- 7: TefPw
- 8: SN+TefPw
- 9: LOID
- 10: LOID+Password

### Power Status
- 1: Normal
- 2: Low
- 3: High
- 4: Unknown

---

## 🎯 Next Steps

### 1. Generate Migration
```bash
cd /Users/rohadimraja/Documents/netmanager
npx prisma migrate dev --name add_zte_an_pon_onu_fields
```

### 2. Update Repository
Update `OnuRepository.ts` untuk support field baru dalam upsert operation.

### 3. Implement Parser
Buat parser baru `getZteAnPonOnuDataViaSNMP()` di `route.ts` untuk mengambil data dari OID `.1082`.

### 4. Update API Endpoint
Update endpoint `/api/olts/onus` untuk:
- Gunakan parser baru untuk OLT yang support base `.1082`
- Fallback ke parser lama (`.1012`) jika diperlukan
- Auto-detect base OID yang didukung per OLT

### 5. Update UI
Update `page.tsx` untuk menampilkan field-field baru:
- Vendor ID
- Equipment ID
- Firmware Version
- MAC Address
- Battery Status
- Auth Mode
- LOID
- Power Level
- Config State
- Last Dereg Time

---

## ⚠️ Catatan Penting

### Perbedaan Base OID

Ada 3 base OID yang berbeda untuk ZTE OLT:

1. **`.1.3.6.1.4.1.3902.1012`** - GPON specific MIB (C300)
   - Sudah diimplementasi sebelumnya
   - Lebih fokus ke GPON management
   
2. **`.1.3.6.1.4.1.3902.1082.50.10`** - Public PON MIB (Universal)
   - **BARU** - Implementasi ini
   - Support GPON & EPON
   - Lebih lengkap dan terstruktur
   
3. **`.1.3.6.1.4.1.3902.1082.500`** - C3XX specific
   - Sudah diimplementasi (untuk C3XX OLT)
   - Berbeda dengan `.1082.50.10`

### Auto-Detection Strategy

Parser harus bisa auto-detect base OID yang didukung:

```typescript
// Priority order for trying parsers
1. Try `.1082.50.10` (ZTE-AN-PON-MIB) - Paling lengkap
2. Try `.1012` (C300 GPON MIB) - Fallback
3. Try `.1082.500` (C3XX) - Fallback untuk C3XX
```

---

## 📚 Referensi

- **Dokumentasi**: GPON MIB Specifications (user-provided)
- **MIB Files**: ZTE-AN-PON-MIB.mib
- **Schema**: `prisma/schema.prisma`
- **Route**: `app/api/olts/onus/route.ts`
- **UI**: `app/admin/network/onu/page.tsx`

---

**Status**: ✅ Schema & OIDs Complete | 🔄 Parser & UI Pending

**Last Updated**: 15 November 2024

