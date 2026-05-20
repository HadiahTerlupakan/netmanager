# OLT Provisioning System — Design Spec

**Date:** 2026-05-20
**Status:** Draft
**Module:** `modules/olt/`

---

## 1. Overview

Sistem provisioning OLT multi-vendor yang terintegrasi di NetManager. Menggantikan NetNumen (ZTE) dan web interface vendor lain sebagai single management interface untuk semua operasi OLT/ONU.

### Goals

- Automate ONU registration, VLAN assignment, dan ONU control
- Support multi-vendor: ZTE (pilot), HSGQ, Hioso, C-Data
- Hybrid flow: auto-provisioning saat pelanggan baru + manual trigger untuk maintenance
- Full audit trail untuk semua operasi provisioning
- Replace NetNumen dan web interface vendor sepenuhnya (long-term)

### Constraints

- OID mapping belum tersedia — perlu riset per vendor saat implementasi
- ZTE menggunakan hybrid protocol (Telnet CLI + SNMP)
- HSGQ, Hioso, C-Data menggunakan SNMP only
- Module ini completely independent dari `modules/network/` (MikroTik)

---

## 2. Architecture

### Pattern: Adapter Pattern + Command Logging

```
OltProvisioningService (orchestrator)
    │
    ├── OltAdapterFactory → resolve adapter by vendor
    │       ├── ZteAdapter (telnet + SNMP) ← PILOT
    │       ├── HsgqAdapter (SNMP) ← skeleton
    │       ├── HiosoAdapter (SNMP) ← skeleton
    │       └── CDataAdapter (SNMP) ← skeleton
    │
    ├── OltConnectionManager (pool SNMP sessions, create telnet per-op)
    ├── OltCommandLogService (audit trail)
    └── EventDispatcher (integrasi module lain)
```

### Module Structure

```
modules/olt/
├── domain/
│   ├── entities/          # OltDevice, OnuDevice, OnuProfile, VlanConfig
│   ├── ports/             # IOltAdapter, IOltRepository, IOnuRepository
│   └── errors/            # OltErrors
├── adapters/
│   ├── OltAdapterFactory.ts
│   ├── OltConnectionManager.ts
│   ├── zte/
│   │   ├── ZteAdapter.ts
│   │   ├── ZteTelnetClient.ts
│   │   └── ZteSnmpClient.ts
│   ├── hsgq/
│   │   └── HsgqAdapter.ts          # skeleton
│   ├── hioso/
│   │   └── HiosoAdapter.ts         # skeleton
│   └── cdata/
│       └── CDataAdapter.ts         # skeleton
├── config/
│   └── oid-registry/
│       ├── zte.oid.ts
│       ├── hsgq.oid.ts             # placeholder
│       ├── hioso.oid.ts            # placeholder
│       └── cdata.oid.ts            # placeholder
├── repositories/
│   ├── OltRepository.ts
│   ├── OnuRepository.ts
│   └── PreRegistrationRepository.ts
├── services/
│   ├── OltProvisioningService.ts
│   ├── OnuDiscoveryService.ts
│   ├── OnuControlService.ts
│   └── OltCommandLogService.ts
├── dto/
├── validators/
└── index.ts
```

### Dependency Rule

```
app/api/olt/ → services/ → adapters/ → OLT fisik
                         → repositories/ → database
                         → events/ → module lain
```

---

## 3. Database Schema

### OltDevice

```prisma
model OltDevice {
  id            String    @id @default(cuid())
  tenantId      String
  name          String
  vendor        OltVendor
  model         String
  ipAddress     String
  snmpCommunity String?
  snmpPort      Int       @default(161)
  telnetPort    Int?      @default(23)
  telnetUser    String?
  telnetPass    String?
  totalPonPorts Int
  location      String?
  status        OltStatus @default(ACTIVE)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  onus          OnuDevice[]
  vlanConfigs   OltVlanConfig[]

  @@index([tenantId])
}

enum OltVendor {
  ZTE
  HSGQ
  HIOSO
  CDATA
}

enum OltStatus {
  ACTIVE
  MAINTENANCE
  OFFLINE
}
```

### OnuDevice

```prisma
model OnuDevice {
  id               String    @id @default(cuid())
  tenantId         String
  oltId            String
  pelangganId      String?
  serialNumber     String
  ponPort          Int
  onuIndex         Int
  vendor           String?
  model            String?
  status           OnuStatus @default(UNREGISTERED)
  rxPower          Float?
  txPower          Float?
  vlanId           Int?
  bandwidthProfile String?
  lastSeen         DateTime?
  registeredAt     DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  olt              OltDevice  @relation(fields: [oltId], references: [id])
  pelanggan        Pelanggan? @relation(fields: [pelangganId], references: [id])
  commandLogs      OltCommandLog[]

  @@unique([oltId, ponPort, onuIndex])
  @@unique([serialNumber])
  @@index([tenantId])
  @@index([oltId])
  @@index([pelangganId])
  @@index([status])
}

enum OnuStatus {
  UNREGISTERED
  REGISTERED
  ACTIVE
  OFFLINE
  DISABLED
  LOS
}
```

### OltVlanConfig

```prisma
model OltVlanConfig {
  id        String      @id @default(cuid())
  tenantId  String
  oltId     String
  ponPort   Int?
  vlanId    Int
  vlanName  String?
  purpose   VlanPurpose @default(INTERNET)
  createdAt DateTime    @default(now())

  olt       OltDevice   @relation(fields: [oltId], references: [id])

  @@index([oltId])
}

enum VlanPurpose {
  INTERNET
  IPTV
  VOIP
  MANAGEMENT
}
```

### OltCommandLog

```prisma
model OltCommandLog {
  id         String        @id @default(cuid())
  tenantId   String
  oltId      String
  onuId      String?
  command    String
  params     Json
  result     CommandResult
  errorMsg   String?
  executedBy String
  executedAt DateTime      @default(now())

  onu        OnuDevice?    @relation(fields: [onuId], references: [id])

  @@index([tenantId, executedAt])
  @@index([oltId])
  @@index([onuId])
}

enum CommandResult {
  SUCCESS
  FAILED
  TIMEOUT
  PENDING
}
```

### OnuPreRegistration

```prisma
model OnuPreRegistration {
  id               String    @id @default(cuid())
  tenantId         String
  serialNumber     String
  oltId            String?
  pelangganId      String?
  bandwidthProfile String?
  vlanId           Int?
  status           PreRegStatus @default(PENDING)
  completedAt      DateTime?
  createdBy        String
  createdAt        DateTime  @default(now())

  @@unique([serialNumber])
  @@index([tenantId, status])
}

enum PreRegStatus {
  PENDING
  COMPLETED
  EXPIRED
  CANCELLED
}
```

---

## 4. Adapter Interface

### IOltAdapter (Core Contract)

```typescript
interface IOltAdapter {
  // Connection
  connect(device: OltDevice): Promise<Result<void, OltError>>
  disconnect(device: OltDevice): Promise<void>
  testConnection(device: OltDevice): Promise<Result<boolean, OltError>>

  // ONU Discovery
  discoverUnregisteredOnus(device: OltDevice): Promise<Result<UnregisteredOnu[], OltError>>
  findOnuBySerialNumber(device: OltDevice, sn: string): Promise<Result<UnregisteredOnu | null, OltError>>

  // ONU Registration
  registerOnu(device: OltDevice, params: RegisterOnuParams): Promise<Result<RegisteredOnu, OltError>>
  deregisterOnu(device: OltDevice, params: DeregisterOnuParams): Promise<Result<void, OltError>>

  // ONU Control
  disableOnu(device: OltDevice, ponPort: number, onuIndex: number): Promise<Result<void, OltError>>
  enableOnu(device: OltDevice, ponPort: number, onuIndex: number): Promise<Result<void, OltError>>
  resetOnu(device: OltDevice, ponPort: number, onuIndex: number): Promise<Result<void, OltError>>
  rebootOnu(device: OltDevice, ponPort: number, onuIndex: number): Promise<Result<void, OltError>>

  // VLAN
  setOnuVlan(device: OltDevice, params: SetVlanParams): Promise<Result<void, OltError>>
  removeOnuVlan(device: OltDevice, params: RemoveVlanParams): Promise<Result<void, OltError>>

  // Monitoring
  getOnuStatus(device: OltDevice, ponPort: number, onuIndex: number): Promise<Result<OnuStatusInfo, OltError>>
  getOnuOpticalPower(device: OltDevice, ponPort: number, onuIndex: number): Promise<Result<OpticalPower, OltError>>
  getAllOnuStatuses(device: OltDevice): Promise<Result<OnuStatusInfo[], OltError>>
}
```

### ZTE Adapter Protocol Split

| Operation | Protocol | Reason |
|-----------|----------|--------|
| Register ONU | Telnet CLI | Reliable, well-documented CLI commands |
| Deregister ONU | Telnet CLI | Requires config mode |
| Set VLAN | Telnet CLI | Complex config sequence |
| Disable/Enable ONU | Telnet CLI | Admin state change via config |
| Reset/Reboot ONU | Telnet CLI | Requires privileged command |
| Discover unregistered | SNMP | Bulk read, fast, no session |
| Get ONU status | SNMP | Stateless read, bulk capable |
| Get optical power | SNMP | Stateless read |
| Find by SN | SNMP + Telnet fallback | SNMP first, telnet jika tidak ketemu |

### ZTE CLI Command Reference

```
# Register ONU
interface gpon-olt_1/1/1
onu <index> type <type> sn <serial_number>

# Set VLAN (service port)
onu <index> service-port <sp_id> vlan <vlan_id> user-vlan <user_vlan>

# Disable ONU
interface gpon-onu_1/1/1:<index>
shutdown

# Enable ONU
interface gpon-onu_1/1/1:<index>
no shutdown

# Reset ONU
pon-onu-mng gpon-onu_1/1/1:<index>
reboot

# Show unregistered
show gpon onu uncfg

# Show ONU status
show gpon onu state gpon-olt_1/1/1
```

---

## 5. Service Layer

### OltProvisioningService

Orchestrator utama. Responsibilities:
- Load OLT dari DB
- Resolve adapter via factory
- Execute operation via adapter
- Persist result ke DB
- Log command ke audit trail
- Emit domain event

### OnuDiscoveryService

Responsibilities:
- Auto-discover: cron job polling semua OLT aktif (interval: 5 menit)
- Manual scan: admin trigger untuk 1 OLT spesifik
- Search by SN: fallback jika auto-discover tidak menemukan
- Pre-registration match: auto-provision saat ONU match dengan pre-reg entry

### OnuControlService

Responsibilities:
- Disable, enable, reset, reboot ONU
- Update status di DB setelah operasi berhasil
- Audit log setiap operasi
- Emit event untuk integrasi (notifikasi, dll)

### OltCommandLogService

Responsibilities:
- Record setiap command yang dikirim ke OLT
- Simpan params, result, error message, user yang trigger
- Query support: filter by OLT, ONU, user, date range, result

---

## 6. Event Integration

### Events Emitted

```
olt.onu.registered        — ONU berhasil di-register
olt.onu.assigned          — ONU di-assign ke pelanggan
olt.onu.disabled          — ONU dimatikan
olt.onu.enabled           — ONU dinyalakan
olt.onu.reset             — ONU di-reset
olt.onu.los               — ONU loss of signal (dari monitoring)
olt.onu.auto_provisioned  — Pre-registration match & auto-provision
```

### Events Listened

```
pelanggan.status.suspended  → auto disable ONU
pelanggan.status.activated  → auto enable ONU
pelanggan.deleted           → deregister ONU
finance.invoice.overdue     → optional: auto disable ONU (configurable)
```

---

## 7. API Routes

```
app/api/olt/
├── devices/
│   ├── route.ts                     GET (list), POST (create)
│   └── [id]/
│       ├── route.ts                 GET, PATCH, DELETE
│       ├── test-connection/route.ts POST
│       ├── scan/route.ts            POST
│       └── vlan-config/route.ts     GET, POST, DELETE
├── onu/
│   ├── route.ts                     GET (list, filter)
│   ├── unregistered/route.ts        GET
│   ├── pre-register/route.ts        POST, GET, DELETE
│   ├── search/route.ts              GET ?sn=XXXX
│   └── [id]/
│       ├── route.ts                 GET, PATCH, DELETE
│       ├── register/route.ts        POST
│       ├── assign/route.ts          POST
│       ├── disable/route.ts         POST
│       ├── enable/route.ts          POST
│       ├── reset/route.ts           POST
│       ├── reboot/route.ts          POST
│       └── optical/route.ts         GET
├── command-logs/route.ts            GET
└── dashboard/route.ts               GET
```

### Permissions

```
olt:view            — Lihat daftar OLT & ONU
olt:manage_device   — CRUD OLT device
olt:register_onu    — Register/deregister ONU
olt:control_onu     — Disable, enable, reset, reboot
olt:assign_onu      — Assign ONU ke pelanggan
olt:view_logs       — Lihat command audit logs
olt:manage_vlan     — CRUD VLAN config
olt:pre_register    — Pre-register ONU SN
```

---

## 8. Admin UI

### Pages

```
app/admin/olt/
├── page.tsx                     Dashboard (summary cards + recent logs)
├── devices/
│   ├── page.tsx                 List OLT (tabel + filter)
│   ├── [id]/
│   │   ├── page.tsx             Detail OLT + list ONU
│   │   └── vlan/page.tsx        VLAN config
│   └── tambah/page.tsx          Form registrasi OLT baru
├── onu/
│   ├── page.tsx                 List semua ONU
│   ├── unregistered/page.tsx    Unregistered + action register
│   ├── pre-register/page.tsx    Pre-register form + list pending
│   └── [id]/page.tsx            Detail ONU (info, optical, logs, actions)
└── logs/page.tsx                Command audit trail
```

### Navigation

Menu admin sidebar → section "OLT Management":
- Dashboard
- Perangkat OLT
- ONU
- ONU Unregistered
- Pre-Register
- Command Logs

---

## 9. Connection Management

### Strategy

- **SNMP sessions**: pooled, reuse selama TTL (60s idle → disconnect)
- **Telnet sessions**: create per-operation, close after done (ZTE CLI stateful, tidak safe di-share)
- **Retry**: max 2 retries untuk timeout/connection lost, exponential backoff
- **Timeout**: SNMP 10s per request, Telnet 30s per command sequence

### Error Recovery

- Connection failed → retry with backoff → log error → return error ke user
- Timeout → retry → jika masih timeout, mark device sebagai potential issue
- Auth failed → no retry → return error langsung
- Command rejected → no retry → log raw response untuk debugging

---

## 10. Phasing Strategy

### Phase 1: Foundation + ZTE Connection

- Database schema (migration)
- Domain entities & ports
- OLT CRUD (register device, test connection)
- ZTE Telnet client + SNMP client
- Connection manager
- Admin UI: list OLT, tambah OLT, test connection
- Skeleton adapter untuk HSGQ, Hioso, C-Data

**Deliverable:** Register OLT ZTE & verify koneksi berhasil

### Phase 2: ONU Discovery & Registration (ZTE)

- ZTE: discover unregistered ONU via SNMP
- ZTE: register ONU via Telnet CLI
- ONU registration flow (register + assign pelanggan)
- Pre-registration system
- Cron job auto-discovery
- Command audit log
- Admin UI: unregistered list, register form, pre-register

**Deliverable:** Full ONU registration flow di ZTE C300/C320

### Phase 3: ONU Control & VLAN (ZTE)

- ZTE: disable, enable, reset, reboot via Telnet
- VLAN configuration per OLT
- VLAN assignment saat registration
- Event integration (pelanggan suspend → auto disable)
- Admin UI: ONU detail, action buttons, VLAN config

**Deliverable:** Full provisioning lifecycle di ZTE

### Phase 4: Multi-Vendor Expansion

- Riset OID untuk HSGQ, Hioso, C-Data
- Implement SNMP adapter per vendor
- Test per vendor dengan OLT fisik
- Handle vendor-specific quirks

**Deliverable:** Semua 4 vendor supported

### Phase 5: Advanced Features

- Bandwidth profile management
- Firmware upgrade ONU
- Bulk operations
- ONU monitoring dashboard (optical power trends)
- Alert integration (LOS → notifikasi)

**Deliverable:** Feature-complete, replace NetNumen

---

## 11. Dependencies

```json
{
  "net-snmp": "^3.x",        // SNMP client (sudah dipakai di project)
  "telnet-client": "^2.x"    // Telnet client untuk ZTE
}
```

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| OID tidak tersedia/salah | Adapter tidak bisa communicate | Riset bertahap, test di lab dulu |
| ZTE CLI berubah antar firmware | Command gagal | Version detection + command variant per firmware |
| Telnet session unstable | Operation gagal di tengah | Retry + rollback logic |
| OLT overload dari polling | Performance degradasi | Rate limiting, configurable interval |
| Concurrent access ke 1 OLT | Race condition | Queue per OLT untuk write operations |

---

## 13. Out of Scope (Phase 1-3)

- OLT firmware management
- ONU firmware upgrade
- Topology auto-mapping dari OLT
- Integration dengan billing/payment auto-suspend (Phase 3 event integration covers basic case)
- Multi-tenant OLT sharing (1 OLT = 1 tenant)
