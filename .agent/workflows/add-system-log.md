---
description: Panduan standar untuk menambahkan System Logging pada modul aplikasi
---

# Add System Log Workflow

Workflow ini digunakan untuk menambahkan pencatatan log aktivitas sistem (audit trail) pada service atau modul apapun.

## 1. Import Logger

Pastikan file service atau route yang akan diedit mengimport `logger` dari library utama.

```typescript
import { logger } from "@/lib/logger";
// atau lazy import jika perlu menghindari circular dependency
// const { logger } = await import('@/lib/logger');
```

## 2. Identifikasi Aksi Krusial

Tentukan aksi mana yang perlu dicatat. Jangan mencatat aksi `GET` (Read) kecuali sangat sensitif. Fokus pada:

- `CREATE`
- `UPDATE`
- `DELETE`
- `APPROVE` / `REJECT`
- `LOGIN` / `LOGOUT`
- `UPLOAD`
- `IMPORT` / `EXPORT`

## 3. Implementasi Logging

Tambahkan kode berikut di dalam blok `try` atau setelah aksi berhasil dilakukan. Pastikan logging bersifat **non-blocking** (menggunakan `await` tapi di dalam blok `try-catch` terpisah jika perlu, atau biarkan async tanpa await jika performa sangat kritikal, namun disarankan `await` untuk memastikan integritas data log).

### Pattern Standar

```typescript
// Contoh di dalam Service Method
async createSomething(data: any, userId: string) {
    // 1. Lakukan aksi utama
    const result = await this.repo.create(data);

    // 2. Catat Log
    try {
        await logger.logActivity({
            action: 'CREATE',
            subject: 'Nama Entitas (misal: Work Order)',
            userId: userId, // ID User yang melakukan aksi
            details: {
                id: result.id,
                name: result.name,
                // data penting lainnya, jangan masukkan objek yang terlalu besar/circular
            }
        });
    } catch (error) {
        // Log error silent agar tidak mengganggu flow utama
        console.error('Failed to create system log:', error);
    }

    return result;
}
```

### Pattern untuk API Route

```typescript
// Contoh di Route Handler
export async function POST(req: NextRequest) {
  // ... auth check ...

  // ... business logic ...

  // Catat Log
  await logger.logActivity({
    action: "UPDATE",
    subject: "User Profile",
    userId: user.id,
    details: {
      changes: updatedFields,
    },
  });

  return NextResponse.json({ success: true });
}
```

## 4. Standar Naming

- **Action**: Gunakan kata kerja UPPERCASE yang konsisten (`CREATE`, `UPDATE`, `DELETE`, `PROCESS`, `VERIFY`).
- **Subject**: Gunakan nama fitur dalam Title Case yang mudah dibaca (`Inventory Barang`, `Keuangan Transaksi`, `Work Order`).

## 5. Verifikasi

Setelah implementasi, selalu verifikasi dengan membuka menu **Admin > System Log > Log Aktivitas** dan pastikan log muncul dengan detail yang benar.
