# Arsitektur Modular Monolith - NetManager

## Prinsip Dasar

NetManager menggunakan arsitektur **Modular Monolith** - sebuah pendekatan yang menggabungkan:

- **Kesederhanaan deployment** dari Monolith
- **Organisasi kode** yang terstruktur seperti Microservices

### Mengapa Modular Monolith?

| Aspek           | Monolith Tradisional | Modular Monolith | Microservices  |
| --------------- | -------------------- | ---------------- | -------------- |
| Deployment      | Sederhana ✅         | Sederhana ✅     | Kompleks ❌    |
| Organisasi Kode | Kacau ❌             | Terstruktur ✅   | Terstruktur ✅ |
| Maintainability | Sulit ❌             | Mudah ✅         | Mudah ✅       |
| Infrastruktur   | Minimal ✅           | Minimal ✅       | Kompleks ❌    |

---

## Struktur Folder

```
netmanager/
├── app/                    # Next.js App Router (UI + API Routes)
│   ├── api/               # API endpoints (Thin Controllers)
│   ├── admin/             # Admin portal pages
│   ├── karyawan/          # Employee portal pages
│   └── (customer)/        # Customer portal pages
│
├── modules/               # 🎯 DOMAIN MODULES (Business Logic)
│   ├── network/          # Network & SNMP operations
│   ├── finance/          # Billing & payments
│   ├── notification/     # Email, Push, WhatsApp
│   ├── work-order/       # Work order management
│   ├── inventory/        # Asset management
│   └── registration/     # Customer registration
│
├── lib/                   # Shared utilities
│   ├── prisma.ts         # Database client (shared)
│   ├── auth.ts           # Authentication
│   ├── utils/            # Helper functions
│   └── validations/      # Zod schemas
│
├── components/            # Reusable UI components
└── docs/                  # Documentation
```

---

## Aturan Module

### 1. Setiap Module Memiliki Public API

```typescript
// modules/<module>/index.ts
export * from "./repositories/ExampleRepository";
export * from "./services/ExampleService";
```

### 2. Import Hanya Melalui Public API

```typescript
// ✅ BENAR
import { ExampleService } from "@/modules/example";

// ❌ SALAH (bypass public API)
import { ExampleService } from "@/modules/example/services/ExampleService";
```

### 3. Tidak Ada Cross-Module Database Access

```typescript
// ✅ BENAR - panggil service dari module lain
import { NotificationService } from '@/modules/notification'
const notif = new NotificationService()
await notif.send(...)

// ❌ SALAH - akses repository module lain langsung
import { NotificationRepository } from '@/modules/notification/repositories/...'
```

### 4. Shared Database adalah OK

Semua module menggunakan satu database Prisma. Ini **bukan** anti-pattern untuk Modular Monolith.

---

## Layer Architecture

```
┌─────────────────────────────────────────────────┐
│                    UI Layer                      │
│           (app/*, components/*)                  │
│         Handles presentation only                │
└───────────────────────┬─────────────────────────┘
                        │ HTTP Request
                        ▼
┌─────────────────────────────────────────────────┐
│               API Layer (Thin)                   │
│              (app/api/*/route.ts)                │
│    Parse request → Call Service → Return response│
└───────────────────────┬─────────────────────────┘
                        │ Function Call
                        ▼
┌─────────────────────────────────────────────────┐
│              Service Layer                       │
│        (modules/*/services/*.ts)                 │
│    Business logic, validation, orchestration     │
└───────────────────────┬─────────────────────────┘
                        │ Function Call
                        ▼
┌─────────────────────────────────────────────────┐
│             Repository Layer                     │
│      (modules/*/repositories/*.ts)               │
│          Data access, Prisma queries             │
└───────────────────────┬─────────────────────────┘
                        │ SQL Query
                        ▼
┌─────────────────────────────────────────────────┐
│                  Database                        │
│                   (Prisma)                       │
└─────────────────────────────────────────────────┘
```

---

## Contoh Implementasi

### Service dengan Validasi

```typescript
// modules/registration/services/RegistrationService.ts
export class RegistrationService {
  private repository: RegistrationRepository;

  constructor() {
    this.repository = new RegistrationRepository();
  }

  async register(input: RegistrationInput) {
    // 1. Validate
    if (!input.email || !input.phone) {
      throw new ValidationError("Email dan phone wajib diisi");
    }

    // 2. Check duplicates
    const existing = await this.repository.findByEmailOrPhone(
      input.email,
      input.phone,
    );
    if (existing) {
      throw new ConflictError("Email atau phone sudah terdaftar");
    }

    // 3. Create
    return await this.repository.create(input);
  }
}
```

### Thin API Route

```typescript
// app/api/registrations/route.ts
import { RegistrationService } from "@/modules/registration";

export async function POST(request: Request) {
  const body = await request.json();
  const service = new RegistrationService();

  try {
    const result = await service.register(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    // Error handling
  }
}
```

---

## Kapan Membuat Module Baru?

Buat module baru jika fitur memiliki:

- **Entity database sendiri** (tabel baru di Prisma)
- **Business logic yang distinct** (tidak terkait erat dengan module lain)
- **Potensi untuk berdiri sendiri** sebagai microservice di masa depan

Jika fitur hanya menambah endpoint sederhana tanpa logic kompleks, pertimbangkan untuk menambahkannya ke module yang sudah ada.

---

## Tech Stack

| Layer          | Technology                  |
| -------------- | --------------------------- |
| Framework      | Next.js 15 (App Router)     |
| Database       | PostgreSQL + Prisma ORM     |
| Auth           | NextAuth.js                 |
| Validation     | Zod                         |
| Styling        | Tailwind CSS                |
| Real-time      | Socket.IO                   |
| Error Tracking | Sentry                      |
| Monitoring     | Custom services di modules/ |

---

## API Utilities

Gunakan utilities di `/lib/api/` untuk standardisasi response dan error handling:

### Standard Response Format

```typescript
import { apiSuccess, apiError, ApiErrors } from "@/lib/api";

// Success response
return apiSuccess({ user: data });
// → { success: true, data: { user: ... } }

// Error response
return apiError("Validation failed", "VALIDATION_ERROR", { status: 400 });
// → { success: false, error: 'Validation failed', code: 'VALIDATION_ERROR' }

// Common error shortcuts
return ApiErrors.unauthorized(); // 401
return ApiErrors.forbidden(); // 403
return ApiErrors.notFound("User"); // 404
return ApiErrors.badRequest("..."); // 400
```

### Paginated Response

```typescript
import { apiPaginated } from "@/lib/api";

return apiPaginated(items, { page: 1, limit: 10, total: 100 });
// → { success: true, data: [...], meta: { page, limit, total, totalPages } }
```

### Unified Handler (New Routes)

Untuk route baru yang sederhana, gunakan `createHandler`:

```typescript
import { createHandler, apiSuccess } from "@/lib/api";
import { z } from "zod";

const schema = z.object({ name: z.string() });

export const POST = createHandler(
  {
    auth: true,
    schema,
  },
  async (req, ctx) => {
    return apiSuccess({ created: ctx.validated.name });
  },
);
```

Untuk route dengan complex auth (site restriction, custom RBAC), tetap gunakan `authorize` middleware.

---

## Referensi

- [Modular Monolith Workflow](.agent/workflows/new-feature.md)
- [Refactor to Service Layer](.agent/workflows/refactor-to-service-layer.md)
- [API Utilities](lib/api/index.ts)
- [Prisma Schema](prisma/schema.prisma)
