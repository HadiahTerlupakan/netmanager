---
description: Panduan langkah-langkah membuat fitur baru mengikuti pola Modular Monolith
---

# Workflow: Membuat Fitur Baru

Ikuti langkah-langkah ini untuk memastikan konsistensi arsitektur saat membuat fitur baru.

## 1. Tentukan Domain Module

Pertama, identifikasi apakah fitur baru ini:
- **Masuk ke module yang sudah ada** (contoh: fitur ONU baru → `modules/network/`)
- **Perlu module baru** (contoh: fitur Registrasi → `modules/registration/`)

**Aturan**: Jika fitur memiliki entity/tabel database sendiri dan logika bisnis yang distinct, buat module baru.

## 2. Buat Struktur Module (Jika Module Baru)

```bash
mkdir -p modules/<nama-module>/repositories
mkdir -p modules/<nama-module>/services
touch modules/<nama-module>/index.ts
```

Struktur standar:
```
modules/<nama-module>/
├── index.ts              # Public API (WAJIB)
├── repositories/
│   ├── I<Entity>Repository.ts   # Interface
│   └── <Entity>Repository.ts    # Implementasi
├── services/
│   └── <Nama>Service.ts         # Business logic
└── types/                       # (Opsional) Type definitions
```

## 3. Buat Repository

Repository menangani semua operasi database.

```typescript
// modules/<module>/repositories/I<Entity>Repository.ts
export interface I<Entity>Repository {
  findById(id: string): Promise<Entity | null>
  findAll(): Promise<Entity[]>
  create(data: CreateInput): Promise<Entity>
  update(id: string, data: UpdateInput): Promise<Entity>
  delete(id: string): Promise<void>
}
```

```typescript
// modules/<module>/repositories/<Entity>Repository.ts
import { prisma } from '@/lib/prisma'
import { I<Entity>Repository } from './I<Entity>Repository'

export class <Entity>Repository implements I<Entity>Repository {
  // Implementasi method
}
```

## 4. Buat Service

Service berisi business logic. **JANGAN taruh logic di API route.**

```typescript
// modules/<module>/services/<Nama>Service.ts
import { <Entity>Repository } from '../repositories/<Entity>Repository'

export class <Nama>Service {
  private repository: <Entity>Repository

  constructor() {
    this.repository = new <Entity>Repository()
  }

  async createSomething(input: Input): Promise<Result> {
    // 1. Validasi input
    // 2. Business logic
    // 3. Panggil repository
    // 4. Return result
  }
}
```

## 5. Buat Public API (index.ts)

**WAJIB**: Semua export harus melalui `index.ts`.

```typescript
// modules/<module>/index.ts
export * from './repositories/<Entity>Repository'
export * from './services/<Nama>Service'
// Export types jika ada
```

## 6. Buat/Update API Route (Thin Controller)

API Route hanya boleh:
1. Menerima request
2. Parse body/params
3. Panggil Service
4. Return response

```typescript
// app/api/<endpoint>/route.ts
import { NextResponse } from 'next/server'
import { <Nama>Service } from '@/modules/<module>'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const service = new <Nama>Service()
    const result = await service.create(body)
    
    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode || 500 }
    )
  }
}
```

## 7. Buat UI Component/Page

Komponen UI hanya menangani presentasi dan form handling.
Panggil API endpoint, **bukan langsung ke service/repository**.

## 8. Verifikasi

// turbo-all
1. Pastikan tidak ada import langsung `@/lib/prisma` di API route (kecuali simple queries)
2. Pastikan semua business logic ada di Service
3. Test endpoint dengan curl atau UI
4. Cek log server tidak ada error

---

## Checklist Sebelum Commit

- [ ] Module memiliki `index.ts` sebagai public API
- [ ] Repository terpisah dari Service
- [ ] API Route "tipis" (thin controller)
- [ ] Tidak ada `prisma` langsung di API route (untuk operasi kompleks)
- [ ] Import menggunakan path module (`@/modules/...`), bukan path internal
