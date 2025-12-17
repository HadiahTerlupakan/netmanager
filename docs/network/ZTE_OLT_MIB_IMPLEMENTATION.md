# Implementasi ZTE OLT MIB berdasarkan Dokumentasi PDF

Dokumentasi ini menjelaskan cara menampilkan Card, PON Port, dan ONU terdaftar berdasarkan **PON OLT Equipment MIB Specifications** dari ZTE.

## 📋 Daftar Isi

1. [Card Information](#1-card-information)
2. [PON Port Information](#2-pon-port-information)
3. [ONU Management](#3-onu-management)
4. [Composite Index](#4-composite-index)

---

## 1. Card Information

### Index Specification

Card Information menggunakan index:
- **zxAnRackNo** (Rack No.) - dimulai dari 0
- **zxAnShelfNo** (Shelf No.) - dimulai dari 0
- **zxAnSlotNo** (Slot No.) - dimulai dari 1

### OID Specification

| MIB Variable | OID | Description |
|-------------|-----|-------------|
| `zxAnCardCfgMainType` | `.1.3.6.1.4.1.3902.1015.2.1.1.3.1.2` | Configured card type |
| `zxAnCardActMainType` | `.1.3.6.1.4.1.3902.1015.2.1.1.3.1.3` | Actual card type (Read Only) |
| `zxAnCardActType` | `.1.3.6.1.4.1.3902.1015.2.1.1.3.1.4` | Card name (Read Only) |
| `zxAnCardOperStatus` | `.1.3.6.1.4.1.3902.1015.2.1.1.3.1.5` | Card status (1=UP/Service, 4=OFFLINE) |
| `zxAnCardCpuLoad` | `.1.3.6.1.4.1.3902.1015.2.1.1.3.1.9` | CPU load (Read Only) |
| `zxAnCardMemUsage` | `.1.3.6.1.4.1.3902.1015.2.1.1.3.1.11` | Memory usage rate (%) (Read Only) |

### Cara Query

```bash
# Get all cards menggunakan SNMP walk
snmpwalk -v2c -c public <OLT_IP> .1.3.6.1.4.1.3902.1015.2.1.1.3.1.5

# Format OID: .1.3.6.1.4.1.3902.1015.2.1.1.3.1.5.{Rack}.{Shelf}.{Slot}
# Contoh: .1.3.6.1.4.1.3902.1015.2.1.1.3.1.5.0.0.2 = Card di Rack 0, Shelf 0, Slot 2
```

### Slot Conversion untuk C300

Berdasarkan dokumentasi PDF, untuk C300 Shelf:

```javascript
// Slot Conversion of C300 Shelf
if ((slot >= 2) && (slot <= 9)) {
  composite_index_slot = slot - 2;
} else if ((slot >= 12) && (slot <= 22)) {
  composite_index_slot = slot - 4;
} else {
  composite_index_slot = 0;
}
```

---

## 2. PON Port Information

### Index Specification

PON Port menggunakan **Type 1 Composite Index** (PON Composite Index).

Format Type 1 Composite Index:
- **bit31-bit28**: Type = 1
- **bit27-bit24**: Shelf No. = 0
- **bit23-bit16**: Slot No. (physical slot, tidak perlu konversi)
- **bit15-bit8**: Port No. atau OLT No.
- **bit7-bit0**: Reserved = 0

Contoh: `gpon-olt_1/2/3` → index = `0x10020300`

### OID Specification

| MIB Variable | OID | Description |
|-------------|-----|-------------|
| PON Port List | `.1.3.6.1.4.1.3902.1012.3.28.1.1.1` | Daftar PON port |
| PON Port Info | `.1.3.6.1.4.1.3902.1012.3.28.1.1.2` | Informasi PON port (slot/card/port info) |

### Cara Query

```bash
# Get all active PON IDs
snmpwalk -v2c -c public <OLT_IP> .1.3.6.1.4.1.3902.1012.3.28.2.1.4

# Format OID: .1.3.6.1.4.1.3902.1012.3.28.2.1.4.{PON_ID}.{ONU_ID}
# Extract PON IDs: sed -n 's/.*\.\([0-9]\+\)\.[0-9]\+ =.*/\1/p' | sort -n | uniq
```

### Konversi PON ID ke Frame/Slot/Port

Berdasarkan dokumentasi, PON ID dapat dikonversi menggunakan formula:

```javascript
// Formula: PONID = (Frame * 16777216) + (Slot * 65536) + (Port * 256)
function ponIdToFrameSlotPort(ponId: number) {
  const frame = Math.floor(ponId / 16777216);
  const remainder1 = ponId % 16777216;
  const slot = Math.floor(remainder1 / 65536);
  const remainder2 = remainder1 % 65536;
  const port = Math.floor(remainder2 / 256);
  
  return { frame, slot, port };
}
```

---

## 3. ONU Management

### Index Specification

**GPON ONU:**
- Index: `{zxGponOltIndex, zxGponONTIndex}`
- `zxGponOltIndex` = Type 1 PON composite index
- `zxGponONTIndex` = ONU numbering (regular index)

**EPON ONU:**
- Index: `{ifIndex}` atau Type 3/9 PON composite index

### OID Specification

#### GPON ONU (Base OID: 1.3.6.1.4.1.3902.1012.3.28)

| MIB Variable | OID | Description |
|-------------|-----|-------------|
| `zxGponOntStatus` | `.1.3.6.1.4.1.3902.1012.3.28.2.1.4` | Status ONU per PON |
| `zxGponOntSerial` | `.1.3.6.1.4.1.3902.1012.3.28.2.1.5` | Serial Number |
| `zxGponOntRxOlt` | `.1.3.6.1.4.1.3902.1012.3.28.2.1.6` | RX OLT (dalam 0.01 dBm) |
| `zxGponOntRxOnu` | `.1.3.6.1.4.1.3902.1012.3.28.2.1.7` | RX ONU (dalam 0.01 dBm) |
| `zxGponOntType` | `.1.3.6.1.4.1.3902.1012.3.28.2.1.8` | ONU Type/Model |
| `zxGponOntName` | `.1.3.6.1.4.1.3902.1012.3.28.2.1.9` | ONU Name |
| `zxGponOntDescription` | `.1.3.6.1.4.1.3902.1012.3.28.2.1.10` | ONU Description |

#### zxGponOntDevMgmtTable

Tabel utama untuk ONU Device Management (dari dokumentasi PDF):

- **OID**: `.1.3.6.1.4.1.3902.1012.3.28.1` (zxGponOntDevMgmtTable)
- **Index**: `{zxGponOltIndex, zxGponONTIndex}`
- **Fungsi**: 
  - Create dan delete ONU di bawah interface OLT tertentu
  - Configure authentication mode
  - Configure authentication information
  - Basic management

**Field penting:**
- `zxGponOntRegId` - PW, LOID authentication information (dapat dimodifikasi)

### Status Values

| Value | Status | Description |
|-------|--------|-------------|
| 1 | LOS | Loss of Signal |
| 3 | Online | ONU Online |
| 4 | DyingGasp | Dying Gasp |
| 6 | OffLine | ONU Offline |

### Cara Query

```bash
# Step 1: Get all active PON IDs
snmpwalk -v2c -c public <OLT_IP> .1.3.6.1.4.1.3902.1012.3.28.2.1.4

# Step 2: Untuk setiap PON ID, get ONU status
# Format: .1.3.6.1.4.1.3902.1012.3.28.2.1.4.{PON_ID}
snmpget -v2c -c public <OLT_IP> .1.3.6.1.4.1.3902.1012.3.28.2.1.4.16777216

# Step 3: Untuk setiap ONU yang terdaftar, get detail
# Format: .1.3.6.1.4.1.3902.1012.3.28.2.1.5.{PON_ID}.{ONU_ID}
snmpget -v2c -c public <OLT_IP> .1.3.6.1.4.1.3902.1012.3.28.2.1.5.16777216.1
```

### Algoritma untuk Mendapatkan Semua ONU

1. **Walk OID Status ONU**: `.1.3.6.1.4.1.3902.1012.3.28.2.1.4`
2. **Extract PON IDs** dari OID yang ditemukan
3. **Untuk setiap PON ID**:
   - Walk OID Status: `.1.3.6.1.4.1.3902.1012.3.28.2.1.4.{PON_ID}`
   - Extract ONU IDs yang statusnya bukan LOS atau OffLine
4. **Untuk setiap ONU**:
   - Get Serial: `.1.3.6.1.4.1.3902.1012.3.28.2.1.5.{PON_ID}.{ONU_ID}`
   - Get Name: `.1.3.6.1.4.1.3902.1012.3.28.2.1.9.{PON_ID}.{ONU_ID}`
   - Get Type: `.1.3.6.1.4.1.3902.1012.3.28.2.1.8.{PON_ID}.{ONU_ID}`
   - Get RX OLT: `.1.3.6.1.4.1.3902.1012.3.28.2.1.6.{PON_ID}.{ONU_ID}`
   - Get RX ONU: `.1.3.6.1.4.1.3902.1012.3.28.2.1.7.{PON_ID}.{ONU_ID}`
   - Get Description: `.1.3.6.1.4.1.3902.1012.3.28.2.1.10.{PON_ID}.{ONU_ID}`

---

## 4. Composite Index

### Type 1 Composite Index (PON Port)

Format: `Type (4 bit) | Shelf (4 bit) | Slot (8 bit) | Port/OLT (8 bit) | Reserved (8 bit)`

```
bit31-bit28: Type = 1
bit27-bit24: Shelf No. = 0
bit23-bit16: Slot No. (physical slot)
bit15-bit8:  Port No. atau OLT No.
bit7-bit0:   Reserved = 0
```

Contoh: `gpon-olt_1/2/3` → `0x10020300`

### Type 3 Composite Index (ONU - 8 port atau kurang)

Format untuk ONU di PON card dengan 8 port atau kurang:

```
bit31-bit28: Type = 3
bit27-bit24: Shelf No. = 0
bit23-bit19: Slot No. (5 bit)
bit18-bit16: OLT No. (3 bit) - untuk C300/C320: (OLT NO. - 1)
bit15-bit8:  ONU No. (8 bit) - (ONU NO. - 1)
bit7-bit0:   Reserved = 0
```

Contoh: `gpon-onu_1/2/3:2` → `0x30020100`

### Type 9 Composite Index (ONU - 16 port)

Format untuk ONU di PON card dengan lebih dari 8 port:

```
bit31-bit28: Type = 9
bit27-bit24: Shelf No. = 0 (3 bit)
bit23-bit19: Slot No. (5 bit)
bit18-bit16: OLT No. (4 bit) - untuk C300/C320: (OLT NO. - 1)
bit15-bit8:  ONU No. (8 bit) - (ONU NO. - 1)
bit7-bit0:   Reserved = 0
```

---

## 📝 Catatan Penting

1. **Base OID untuk Hardware Monitoring**: `1.3.6.1.4.1.3902.1015` (Card, Fan, Temperature, dll)
2. **Base OID untuk GPON/ONU Monitoring**: `1.3.6.1.4.1.3902.1012` (GPON ONU management)
3. **Base OID untuk ZTE C3XX**: `1.3.6.1.4.1.3902.1082` (C3XX specific)
4. **Slot Conversion**: Untuk C300, slot perlu dikonversi sesuai formula di atas
5. **PON Composite Index**: Menggunakan physical slot number, tidak perlu konversi
6. **Platform Composite Index**: Menggunakan logical slot number (setelah konversi)

---

## 🔧 Implementasi di Kode

### File: `app/api/olts/onus/route.ts`

- `getAllCardsViaSNMP()` - Mendapatkan daftar card dari OLT
- `getAllActivePonIds()` - Mendapatkan daftar PON ID aktif
- `getOnuDataViaSNMP()` - Mendapatkan data ONU terdaftar

### File: `app/api/olts/[id]/cards/route.ts`

- `GET /api/olts/{id}/cards` - API endpoint untuk mendapatkan cards

### File: `app/admin/network/onu/page.tsx`

- Halaman frontend untuk menampilkan semua ONU dengan filter dan search

---

## 📚 Referensi

- **Dokumentasi PDF**: `5_6104880039386423049.pdf` - PON OLT Equipment MIB Specifications
- **MIB Files**: 
  - `ZXANEPON-ONUMGMT-MIB.mib` (EPON)
  - `zxGponService.mib` (GPON)
  - `ZXEPON-SERVICE-PRIVATE-MIB.mib` (EPON Service)

---

**Dokumentasi ini dibuat berdasarkan:**
- PON OLT Equipment MIB Specifications (ZTE do Brasil, 18/02/2015)
- Implementasi kode yang ada di repository
- Template Zabbix untuk ZTE C300-B

