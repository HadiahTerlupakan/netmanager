# Clean Architecture Guide

## Module Baru — Target Architecture (WAJIB)

Module baru wajib menggunakan struktur lengkap dengan `domain/` layer:

```
modules/<domain>/
├── domain/         # Pure domain entities & interfaces — bebas dari Prisma & framework
│   ├── entities/   # Domain entity (plain TypeScript interface/class)
│   └── ports/      # Repository interface (IXxxRepository) — abstraksi, bukan implementasi
├── dto/            # Data Transfer Objects — shape data yang masuk/keluar module
├── types/          # Shared types & enums internal module
├── repositories/   # Implementasi konkret dari domain/ports (menggunakan Prisma)
├── factories/      # Object creation logic
├── mappers/        # Transformasi: Prisma model ↔ Domain entity ↔ DTO
├── services/       # Business logic & orchestration
├── utils/          # Pure helper functions, tidak ada side effect
├── validators/     # Input validation (Zod schemas)
└── index.ts        # Public API — satu-satunya pintu keluar module
```

## Data Flow Module Baru

```
Request → API Route → Service → Repository (via port/interface)
                                      ↓
                               Prisma Model
                                      ↓
                               Domain Entity (via Mapper)
                                      ↓
Response ← API Route ← Service ← DTO (via Mapper)
```

## Dependency Rule Module Baru

- `domain/` tidak boleh import apapun dari luar (no Prisma, no framework)
- `services/` bergantung pada `domain/ports/` (interface), bukan `repositories/` konkret
- `repositories/` mengimplementasikan `domain/ports/` dan boleh import Prisma
- `mappers/` menangani transformasi di semua arah: Prisma ↔ Domain Entity ↔ DTO

## Module Lama — Current State (Toleransi Sementara)

Module lama yang belum dimigrasi masih menggunakan pola lama yang ditolerasi:

```
modules/<domain>/
├── dto/            # DTO langsung digunakan tanpa domain entity
├── types/          # Types & interfaces
├── repositories/   # Data access — Prisma model boleh return langsung ke service
│   └── IXxxRepository.ts  # Interface wajib ada, meski return type masih Prisma model
├── factories/      # Object creation
├── mappers/        # Transformasi Prisma model → DTO langsung
├── services/       # Business logic
├── utils/          # Helpers
└── index.ts        # Public API
```

**Data Flow module lama (toleransi sementara):**
```
Request → API Route → Service → Repository → Prisma Model
                                                   ↓
Response ← API Route ← Service ←── Mapper ────────┘
                                      ↓
                                     DTO
```

> ⚠️ Prisma model boleh ada di dalam service sementara, tapi **tidak boleh keluar dari module** — API route tetap harus return DTO.

## Migration Strategy

**Trigger migrasi module lama:**
1. Saat ada penambahan fitur signifikan pada module tersebut
2. Saat ada bug besar yang memerlukan refactor
3. Saat diminta review → langsung migrasi

**Langkah migrasi module lama → baru:**
1. Buat `domain/entities/` — ekstrak pure interface dari DTO yang sudah ada
2. Pindahkan `IXxxRepository` ke `domain/ports/`
3. Update return type repository dari Prisma model → Domain entity
4. Update mapper: pisahkan `Prisma → Domain` dan `Domain → DTO`
5. Update service: gunakan domain entity, bukan Prisma model
6. Verifikasi `index.ts` hanya export DTO dan services

## Aturan Berlaku untuk Semua Module

**Dependency Rule:**
```
app/ (UI)  →  api/ (Controller)  →  services/  →  repositories/  →  database
```

**Yang wajib di semua module tanpa pengecualian:**
- Repository interface wajib ada di semua module
- API route selalu return DTO, tidak pernah Prisma model mentah
- `index.ts` sebagai satu-satunya public API module
- Mapper wajib ada untuk transformasi data antar layer

## Layer Rules

| Folder | Module Baru | Module Lama (Toleransi) |
|---|---|---|
| `domain/` | Pure TS, no Prisma, no framework | — (belum ada) |
| `services/` | Depend on `domain/ports/` | Depend on `IXxxRepository` di `repositories/` |
| `repositories/` | Implement `domain/ports/`, pakai Prisma | Implement `IXxxRepository`, pakai Prisma |
| `mappers/` | Prisma ↔ Domain Entity ↔ DTO | Prisma model → DTO langsung |
| `dto/` | Pure TS interfaces | Pure TS interfaces + Prisma enum boleh |
| `index.ts` | Export DTO + services only | Export DTO + services only |

## Module Public API (`index.ts`)

```typescript
// Good index.ts
export type { CreateUserDTO, UserDetailDTO } from "./dto/UserDTO";
export { UserService } from "./services/UserService";
export { userCreateSchema } from "./validators";

// Bad index.ts
export { UserRepository } from "./repositories/UserRepository"; // ❌
export { UserMapper } from "./mappers/UserMapper"; // ❌
export type { UserEntity } from "./domain/entities/UserEntity"; // ❌
```
