# Implementasi ONU Type berdasarkan Dokumentasi PDF

Dokumentasi ini menjelaskan implementasi menu ONU Type berdasarkan **PON OLT Equipment MIB Specifications** dari ZTE.

## 📋 Daftar Isi

1. [ONU Type Management](#1-onu-type-management)
2. [Metode Sync ONU Type](#2-metode-sync-onu-type)
3. [ONU Version and Model (SNMP)](#3-onu-version-and-model-snmp)
4. [Struktur Data](#4-struktur-data)

---

## 1. ONU Type Management

### Informasi yang Disimpan

Berdasarkan dokumentasi dan implementasi saat ini, ONU Type menyimpan informasi berikut:

#### Informasi Dasar
- **Name**: Nama tipe ONU (e.g., "ZTE", "H640GW", "HG8245H")
- **PON Type**: Tipe PON (e.g., "gpon")
- **Description**: Deskripsi ONU type

#### Port Configuration
- **Ethernet Ports**: Jumlah port Ethernet (0-10)
- **WiFi**: Jumlah WiFi SSID (0-10)
- **VoIP Ports**: Jumlah port VoIP (0-10)

#### Batas Maksimum
- **Max T-CONT**: Maksimum T-CONT
- **Max GEM Port**: Maksimum GEM port
- **Max Switch per Slot**: Maksimum switch per slot
- **Max Flow per Switch**: Maksimum flow per switch
- **Max IP Host**: Maksimum IP host
- **Max IPv6 Host**: Maksimum IPv6 host
- **Max VEIP**: Maksimum VEIP

#### Service Abilities
- **Service Ability N:1**: Support untuk N:1
- **Service Ability 1:M**: Support untuk 1:M
- **Service Ability 1:P**: Support untuk 1:P

#### Konfigurasi
- **WIFI mgmt via non OMCI**: Enable/disable
- **OMCI send mode**: Mode pengiriman OMCI (e.g., "async")
- **Default multicast range**: Range multicast default
- **VRG**: VRG configuration
- **MGC configure mode**: Mode konfigurasi MGC (e.g., "zte")
- **Extended OMCI**: Enable/disable extended OMCI
- **Location**: Location configuration

---

## 2. Metode Sync ONU Type

### A. Sync dari Telnet (Sudah Diimplementasikan)

**Command**: `show onu-type`

**Endpoint**: `POST /api/olts/{id}/onutypes/sync`

**Cara Kerja**:
1. Connect ke OLT via Telnet
2. Execute command `show onu-type`
3. Parse output untuk mendapatkan semua ONU type
4. Simpan ke database

**Format Output Telnet**:
```
ONU type name:          ALL
PON type:              gpon
Description:            ZTE ONU
Max T-CONT:            8
Max GEM port:           128
...
```

### B. Sync dari SNMP (Berdasarkan Dokumentasi PDF)

**OID untuk ONU Type/Model**:
- **ONU Type**: `.1.3.6.1.4.1.3902.1012.3.28.2.1.8.{PON_ID}.{ONU_ID}` (GPON)
- **ONU Model (EPON)**: `.1.3.6.1.4.1.3902.1015.1010.1.1.1.1.1.3.{composite_index}`

**Index Specification**:
- GPON: `{PON_ID}.{ONU_ID}` - PON ID dan ONU ID
- EPON: Type 3's PON composite index

**Cara Query**:
```bash
# Get ONU Type dari setiap ONU yang terdaftar
snmpget -v2c -c public <OLT_IP> .1.3.6.1.4.1.3902.1012.3.28.2.1.8.{PON_ID}.{ONU_ID}
```

**Algoritma**:
1. Walk OID Status ONU untuk mendapatkan semua ONU terdaftar
2. Untuk setiap ONU, get ONU Type
3. Group ONU Type yang sama
4. Simpan ke database

---

## 3. ONU Version and Model (SNMP)

Berdasarkan dokumentasi PDF section 7.8, ada OID untuk mendapatkan informasi versi dan model ONU:

### OID Specification

| MIB Variable | OID | Description | Index |
|-------------|-----|-------------|-------|
| `zxAnEponOnuModel` | `.1.3.6.1.4.1.3902.1015.1010.1.1.1.1.1.3` | ONU model | Type 3's PON composite index |
| `zxAnEponOnuSoftwareVersion` | `.1.3.6.1.4.1.3902.1015.1010.1.1.1.1.1.6` | Software version | Type 3's PON composite index |
| `zxAnEponOnuHardwareVersion` | `.1.3.6.1.4.1.3902.1015.1010.1.1.1.1.1.5` | Hardware version | Type 3's PON composite index |

### Index Specification

**Type 3 Composite Index** (untuk EPON):
- **bit31-bit28**: Type = 3
- **bit27-bit24**: Shelf No. = 0
- **bit23-bit19**: Slot No. (5 bit)
- **bit18-bit16**: OLT No. (3 bit) - untuk C300/C320: (OLT NO. - 1)
- **bit15-bit8**: ONU No. (8 bit) - (ONU NO. - 1)
- **bit7-bit0**: Reserved = 0

Contoh: `gpon-onu_1/2/3:2` → index = `0x30020100`

### Cara Query

```bash
# Get ONU Model
snmpget -v2c -c public <OLT_IP> .1.3.6.1.4.1.3902.1015.1010.1.1.1.1.1.3.{composite_index}

# Get Software Version
snmpget -v2c -c public <OLT_IP> .1.3.6.1.4.1.3902.1015.1010.1.1.1.1.1.6.{composite_index}

# Get Hardware Version
snmpget -v2c -c public <OLT_IP> .1.3.6.1.4.1.3902.1015.1010.1.1.1.1.1.5.{composite_index}
```

---

## 4. Struktur Data

### Database Schema (Prisma)

```prisma
model OnuType {
  id            String   @id @default(cuid())
  oltId         String
  olt           Olt      @relation(fields: [oltId], references: [id], onDelete: Cascade)
  name          String   // Nama tipe ONU (e.g., "ZTE", "H640GW", "HG8245H")
  ethernetPorts Int      @default(0) // Jumlah port Ethernet
  wifi          Int      @default(0) // Jumlah WiFi
  voipPorts     Int      @default(0) // Jumlah port VoIP
  // Detail dari show onu-type
  ponType       String?  // PON type (e.g., "gpon")
  description   String?  // Description
  maxTcont      Int?     // Max T-CONT
  maxGemPort    Int?     // Max GEM port
  maxSwitchPerSlot Int?  // Max switch per slot
  maxFlowPerSwitch Int?  // Max flow per switch
  maxIpHost     Int?     // Max IP host
  maxIpv6Host   Int?     // Max IPv6 host
  serviceAbilityN1 String? // Service ability N:1 (e.g., "support")
  serviceAbility1M String? // Service ability 1:M (e.g., "support")
  serviceAbility1P String? // Service ability 1:P (e.g., "support")
  wifiMgmtViaNonOmci String? // WIFI mgmt via non OMCI (e.g., "disable")
  omciSendMode  String?  // OMCI send mode (e.g., "async")
  defaultMulticastRange String? // Default multicast range (e.g., "none")
  vrg           String?  // VRG (e.g., "disable")
  mgcConfigureMode String? // MGC configure mode (e.g., "zte")
  maxVeip       Int?     // Max VEIP
  extendedOmci   String? // Extended OMCI (e.g., "disable")
  location      String?  // Location (e.g., "disable")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([oltId, name]) // Satu tipe ONU unik per OLT berdasarkan name
  @@index([oltId])
}
```

---

## 🔧 Implementasi di Kode

### File: `app/admin/network/onutype/page.tsx`

Halaman frontend untuk menampilkan dan mengelola ONU Type:
- List semua ONU Type per OLT
- Filter berdasarkan OLT
- Sync dari Telnet
- Create, View Detail, Delete

### File: `app/api/olts/[id]/onutypes/sync/route.ts`

API endpoint untuk sync ONU Type dari Telnet:
- Connect ke OLT via Telnet
- Execute command `show onu-type`
- Parse output
- Simpan ke database

### File: `app/api/onutypes/route.ts`

API endpoint untuk CRUD ONU Type:
- `GET /api/onutypes` - Get all ONU types
- `POST /api/onutypes` - Create new ONU type

### File: `app/api/onutypes/[id]/route.ts`

API endpoint untuk update dan delete:
- `PATCH /api/onutypes/{id}` - Update ONU type
- `DELETE /api/onutypes/{id}` - Delete ONU type

---

## 📝 Catatan Penting

1. **Sync dari Telnet**: Menggunakan command `show onu-type` untuk mendapatkan semua ONU type yang dikonfigurasi di OLT
2. **Sync dari SNMP**: Bisa digunakan untuk mendapatkan ONU Type dari ONU yang sudah terdaftar (actual type)
3. **ONU Type vs Actual Type**: 
   - **ONU Type**: Tipe yang dikonfigurasi di OLT (dari `show onu-type`)
   - **Actual Type**: Tipe aktual dari ONU yang terdaftar (dari SNMP)
4. **Composite Index**: Untuk EPON, menggunakan Type 3 composite index
5. **Unique Constraint**: Satu ONU type unik per OLT berdasarkan name

---

## 🚀 Fitur yang Tersedia

### ✅ Sudah Diimplementasikan

1. **List ONU Type** - Menampilkan semua ONU type per OLT
2. **Create ONU Type** - Manual create ONU type
3. **Sync dari Telnet** - Sync ONU type dari OLT menggunakan command `show onu-type`
4. **View Detail** - Melihat detail lengkap ONU type
5. **Delete** - Menghapus ONU type

### 🔄 Bisa Ditambahkan (Berdasarkan Dokumentasi PDF)

1. **Sync dari SNMP** - Sync ONU type dari SNMP berdasarkan ONU yang terdaftar
2. **ONU Version Info** - Menampilkan Software Version dan Hardware Version
3. **Edit ONU Type** - Update informasi ONU type
4. **Bulk Import** - Import ONU type dari file

---

## 📚 Referensi

- **Dokumentasi PDF**: `5_6104880039386423049.pdf` - PON OLT Equipment MIB Specifications
- **Section 7.8**: ONU Version and Model
- **Section 8.1**: GPON ONU Management
- **MIB Files**: 
  - `ZXANEPON-ONUMGMT-MIB.mib` (EPON)
  - `zxGponService.mib` (GPON)

---

**Dokumentasi ini dibuat berdasarkan:**
- PON OLT Equipment MIB Specifications (ZTE do Brasil, 18/02/2015)
- Implementasi kode yang ada di repository
- Struktur database Prisma

