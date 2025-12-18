# Network Module

Module ini menangani semua operasi jaringan, termasuk manajemen OLT, ONU, MikroTik, dan pemetaan infrastruktur (Pole, ODP, ODC).

## Struktur

- `repositories/`: Akses data ke database (Prisma).
- `services/`: Logika bisnis dan interaksi dengan perangkat fisik (SNMP, API).
- `index.ts`: Public interface untuk module ini.

## Penggunaan

Gunakan import dari root module:

```typescript
import { OLTRepository, OnuService } from '@/modules/network';

// Repository
const oltRepo = new OLTRepository();

// Service
const onuService = new OnuService();
```

## Dependencies
- `@/lib/prisma`: Database connection.
- `net-snmp`: SNMP library.
- `@/lib/logger`: Logging utility.
