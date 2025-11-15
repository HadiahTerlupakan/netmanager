# ZTE VLAN SNMP OIDs Implementation

Dokumentasi ini menjelaskan implementasi SNMP OIDs untuk VLAN berdasarkan dokumentasi ZTE (`5_6104880039386423049.pdf`).

## Sumber Dokumentasi

- **MIB File**: `ZTE-AN-VLAN-MIB.mib`
- **PDF Dokumentasi**: `5_6104880039386423049.pdf` (Section 4.1 VLAN)

## OID yang Digunakan

### 1. VLAN Interface (L3 Interface)

OID ini digunakan untuk mendapatkan informasi tentang VLAN interface yang memiliki IP address.

| OID | Nama MIB | Deskripsi |
|-----|----------|-----------|
| `1.3.6.1.4.1.3902.1015.4.1.1` | `zxAnL3IfTable` | Base OID untuk L3 Interface Table |
| `1.3.6.1.4.1.3902.1015.4.1.1.1.1` | `zxAnL3IfIndex` | Interface index |
| `1.3.6.1.4.1.3902.1015.4.1.1.1.2` | `zxAnL3IfName` | VLAN Interface Name (e.g., "VLAN100") |
| `1.3.6.1.4.1.3902.1015.4.1.1.1.3` | `zxAnIfReferIndex` | Referenced interface index |
| `1.3.6.1.4.1.3902.1015.4.1.1.1.4` | `zxAnL3IfArpProxyEnable` | ARP proxy enable |
| `1.3.6.1.4.1.3902.1015.4.1.1.1.5` | `zxAnL3IfRowStatus` | Row status |

### 2. VLAN Interface IP Address

OID ini digunakan untuk mendapatkan IP address dan subnet mask dari VLAN interface.

| OID | Nama MIB | Deskripsi |
|-----|----------|-----------|
| `1.3.6.1.4.1.3902.1015.4.1.3` | `zxAnL3IfIpAddressTable` | Base OID untuk IP Address Table |
| `1.3.6.1.4.1.3902.1015.4.1.3.1.1` | `zxAnL3IfIp` | IP Address of VLAN Interface |
| `1.3.6.1.4.1.3902.1015.4.1.3.1.2` | `zxAnL3IfMask` | Subnet Mask |
| `1.3.6.1.4.1.3902.1015.4.1.3.1.3` | `zxAnL3IfIpCatagory` | IP Category |
| `1.3.6.1.4.1.3902.1015.4.1.3.1.4` | `zxAnL3IfIpRowStatus` | Row status |

### 3. VLAN Port Configuration

OID ini digunakan untuk mendapatkan konfigurasi VLAN pada port.

| OID | Nama MIB | Deskripsi |
|-----|----------|-----------|
| `1.3.6.1.4.1.3902.1015.20.4` | `zxAnVlanPortConfVlanCmdTable` | Base OID untuk VLAN Port Config |
| `1.3.6.1.4.1.3902.1015.20.4.1.1` | `zxAnVlanPortConfVlanCmd` | VLAN command |
| `1.3.6.1.4.1.3902.1015.20.4.1.2` | `zxAnVlanPortConfVlanId` | VLAN ID |

### 4. Service Port VLAN Configuration

OID ini digunakan untuk mendapatkan konfigurasi VLAN pada service port.

| OID | Nama MIB | Deskripsi |
|-----|----------|-----------|
| `1.3.6.1.4.1.3902.1015.8.1.1.1.10` | `zxAnUserTlsVlan` | User TLS VLAN |
| `1.3.6.1.4.1.3902.1015.8.1.1.1.13` | `zxAnVlanTransMode` | VLAN Translation Mode |

## Implementasi

### Struktur OID

Format OID untuk ZTE VLAN menggunakan composite index atau interface index:

- **L3 Interface**: `{baseOID}.{interfaceIndex}.{field}`
  - Contoh: `1.3.6.1.4.1.3902.1015.4.1.1.1.2.100` = VLAN Interface Name untuk interface index 100

- **L3 Interface IP**: `{baseOID}.{interfaceIndex}.{ipIndex}.{field}`
  - Contoh: `1.3.6.1.4.1.3902.1015.4.1.3.1.1.100.1` = IP Address untuk interface index 100, IP index 1

- **VLAN Port Config**: `{baseOID}.{portIndex}.{field}`
  - Contoh: `1.3.6.1.4.1.3902.1015.20.4.1.2.100` = VLAN ID untuk port index 100

### Cara Menggunakan

1. **SNMP Walk** pada base OID untuk mendapatkan semua entry
2. **Parse OID** untuk mendapatkan index (interface index, port index, dll)
3. **Gabungkan data** dari berbagai OID berdasarkan index yang sama
4. **Fallback ke BRIDGE-MIB** jika OID ZTE tidak tersedia

### Contoh Query

```bash
# Get VLAN Interface Names
snmpwalk -v2c -c public <OLT_IP>:<PORT> 1.3.6.1.4.1.3902.1015.4.1.1.1.2

# Get VLAN Interface IP Addresses
snmpwalk -v2c -c public <OLT_IP>:<PORT> 1.3.6.1.4.1.3902.1015.4.1.3.1.1

# Get VLAN Port Config VLAN IDs
snmpwalk -v2c -c public <OLT_IP>:<PORT> 1.3.6.1.4.1.3902.1015.20.4.1.2
```

## Keuntungan Menggunakan OID ZTE

1. **Informasi Lebih Lengkap**: Mendapatkan IP address dan subnet mask untuk setiap VLAN interface
2. **Lebih Spesifik**: OID ZTE memberikan informasi yang lebih detail tentang konfigurasi VLAN
3. **Lebih Akurat**: Menggunakan OID vendor-specific biasanya lebih akurat untuk perangkat ZTE

## Kompatibilitas

- Implementasi saat ini menggunakan **kedua metode**:
  - **Standard BRIDGE-MIB** (untuk kompatibilitas dengan berbagai vendor)
  - **ZTE-specific OIDs** (untuk informasi lebih lengkap dari perangkat ZTE)

- Jika OID ZTE tidak tersedia, sistem akan fallback ke BRIDGE-MIB standard.

## Referensi

- Dokumentasi ZTE: `5_6104880039386423049.pdf` (Section 4.1 VLAN)
- MIB File: `ZTE-AN-VLAN-MIB.mib`
- Implementasi: `/app/api/olts/[id]/vlans/route.ts`

