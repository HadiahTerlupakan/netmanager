---
description: Workflow untuk refactor API routes ke Service Layer pattern
---

# Refactor to Service Layer Pattern

Workflow standar untuk refactoring API routes yang langsung akses Prisma menjadi menggunakan Service Layer pattern sesuai arsitektur Modular Monolith.

## Prasyarat

- Pahami struktur module existing di `/modules/`
- Baca contoh implementasi baik: `modules/attendance/` (Repository + Service lengkap)
- Pastikan `npm run dev` berjalan untuk validasi real-time

---

## Step 1: Identifikasi Target

Tentukan API route yang akan di-refactor:

```bash
# Cek penggunaan prisma langsung di route
grep -r "prisma\." app/api/<target-route>/
```

Catat:

- [ ] Entity utama yang diakses (e.g., `pelanggan`, `invoice`)
- [ ] Module yang sesuai (e.g., `pelanggan`, `finance`, `network`)
- [ ] Methods Prisma yang digunakan (`findMany`, `create`, `update`, dll)

---

## Step 2: Buat/Extend Repository

### Jika Repository Belum Ada:

```bash
# Buat file baru
touch modules/<module>/repositories/<Entity>Repository.ts
touch modules/<module>/repositories/I<Entity>Repository.ts
```

```typescript
// modules/<module>/repositories/I<Entity>Repository.ts
export interface I<Entity>Repository {
  findById(id: string): Promise<Entity | null>
  findMany(params: FindManyParams): Promise<Entity[]>
  count(where?: WhereInput): Promise<number>
  create(data: CreateInput): Promise<Entity>
  update(id: string, data: UpdateInput): Promise<Entity>
  delete(id: string): Promise<void>
}
```

```typescript
// modules/<module>/repositories/<Entity>Repository.ts
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { I<Entity>Repository } from './I<Entity>Repository'

export class <Entity>Repository implements I<Entity>Repository {
  async findById(id: string) {
    return prisma.<entity>.findUnique({ where: { id } })
  }

  async findMany(params: {
    skip?: number
    take?: number
    where?: Prisma.<Entity>WhereInput
    orderBy?: Prisma.<Entity>OrderByWithRelationInput
    include?: Prisma.<Entity>Include
  }) {
    return prisma.<entity>.findMany(params)
  }

  // ... tambahkan methods sesuai kebutuhan
}
```

### Jika Repository Sudah Ada:

// turbo

1. Cek methods yang sudah ada
2. Tambahkan methods yang diperlukan
3. Pastikan tidak duplikasi

---

## Step 3: Buat/Extend Service

```typescript
// modules/<module>/services/<Module>Service.ts
import { <Entity>Repository } from '../repositories/<Entity>Repository'

export class <Module>Service {
  private repository: <Entity>Repository

  constructor() {
    this.repository = new <Entity>Repository()
  }

  /**
   * Business logic method
   * @param input - Input parameters
   * @returns Result
   */
  async doSomething(input: Input): Promise<Result> {
    // 1. Input validation (jika perlu)

    // 2. Business logic

    // 3. Call repository
    const result = await this.repository.findById(input.id)

    // 4. Transform/process result jika perlu

    // 5. Return
    return result
  }
}
```

**PENTING**:

- Business logic HARUS di Service, BUKAN di Repository atau Route
- Repository hanya untuk operasi database
- Service menangani validasi, kalkulasi, transformasi

---

## Step 4: Update Module Index

Pastikan export di `modules/<module>/index.ts`:

```typescript
// modules/<module>/index.ts
export * from "./repositories/<Entity>Repository";
export * from "./services/<Module>Service";
```

---

## Step 5: Refactor API Route (Thin Controller)

**SEBELUM** (langsung prisma):

```typescript
// app/api/<endpoint>/route.ts
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const data = await prisma.<entity>.findMany({...})
  return NextResponse.json(data)
}
```

**SESUDAH** (via service):

```typescript
// app/api/<endpoint>/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { <Module>Service } from '@/modules/<module>'

export async function GET(req: NextRequest) {
  try {
    const service = new <Module>Service()
    const data = await service.getData()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[API <Endpoint>]', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.statusCode || 500 }
    )
  }
}
```

---

## Step 6: Verifikasi

// turbo

1. Pastikan server dev tidak error
2. Test endpoint dengan curl atau browser:
   ```bash
   curl http://localhost:3000/api/<endpoint>
   ```
3. Cek tidak ada regresi di UI terkait

---

## Step 7: Update Tests (Jika Ada)

Jika ada test file di `tests/modules/<module>/`:

// turbo

1. Update import ke service baru
2. Mock repository jika perlu
3. Run test:
   ```bash
   npm run test -- tests/modules/<module>/
   ```

---

## Checklist Final

- [ ] Repository terpisah dari Service
- [ ] Tidak ada `prisma` langsung di API route
- [ ] Business logic di Service, bukan Route
- [ ] Export melalui `index.ts` module
- [ ] Import menggunakan `@/modules/<module>`
- [ ] Error handling di route layer
- [ ] Log dengan prefix `[API <Endpoint>]`

---

## Template Commit Message

```
refactor(<module>): migrate <endpoint> to service layer

- Move prisma queries to <Entity>Repository
- Add business logic to <Module>Service
- Refactor route to thin controller
```
