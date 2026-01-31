# Rencana Adopsi Domain-Driven Design (DDD) untuk NetManager

Dokumen ini menjelaskan bagaimana pola **Repository -> Service -> Domain -> Controller -> Factory & Mapper** dapat diterapkan pada kode NetManager yang sudah ada.

## 1. Analisis Kondisi Saat Ini (Current State)

Saat ini, NetManager menggunakan **Service-Based Architecture** dengan **Anemic Domain Model**.

| Layer          | Status di Codebase Saat Ini                 | Contoh File                                             |
| :------------- | :------------------------------------------ | :------------------------------------------------------ |
| **Repository** | ✅ Sudah Ada                                | `modules/finance/repositories/TransactionRepository.ts` |
| **Service**    | ✅ Sudah Ada                                | `modules/finance/services/FinanceService.ts`            |
| **Controller** | ✅ Sudah Ada (Route Handlers)               | `app/api/admin/chat/users/route.ts`                     |
| **Domain**     | ❌ Belum Ada (Menggunakan Prisma Types)     | -                                                       |
| **Factory**    | ⚠️ Parsial (Hanya modul tertentu)           | `notification/services/whatsapp/whatsapp-factory.ts`    |
| **Mapper**     | ❌ Belum Ada (Repository return raw Prisma) | -                                                       |

**Kesimpulan:** Codebase saat ini melompati langkah "Domain" dan "Mapper". Logic bisnis tercampur di Service, dan struktur data sangat terikat dengan database (Prisma).

## 2. Peta Transformasi (The "How-To")

Berikut adalah cara menerapkan urutan belajar Anda ke dalam modul `finance` (sebagai contoh pilot project):

### Langkah 1: Domain Method (Inti Perubahan)

Alih-alih menggunakan tipe data mentah dari Prisma, kita membuat Class yang memiliki _behavior_.

**Sebelum (Prisma Type):**

```typescript
// Hanya data, tidak ada logic
type Transaction = {
  id: string;
  amount: number;
  status: string;
};
```

**Sesudah (Domain Entity):**

```typescript
// modules/finance/domain/Transaction.ts
export class TransactionEntity {
  constructor(
    public id: string,
    public amount: number,
    private _status: "PENDING" | "PAID" | "FAILED",
  ) {}

  // ✅ Domain Method: Logic ada di sini, bukan di Service
  approve(): void {
    if (this._status === "PAID") throw new Error("Already paid");
    this._status = "PAID";
  }

  isLargeTransaction(): boolean {
    return this.amount > 10000000;
  }
}
```

### Langkah 2: Mapper (Penghubung)

Kita butuh jembatan antara Database (Prisma) dan Domain Entity.

```typescript
// modules/finance/mappers/TransactionMapper.ts
export class TransactionMapper {
  static toDomain(raw: PrismaTransaction): TransactionEntity {
    return new TransactionEntity(raw.id, raw.amount, raw.status);
  }

  static toPersistence(
    domain: TransactionEntity,
  ): PrismaTransactionCreateInput {
    return {
      id: domain.id,
      amount: domain.amount,
      status: domain.status,
    };
  }
}
```

### Langkah 3: Repository (Update)

Repository tidak lagi mengembalikan Prisma type, tapi Domain Entity.

```typescript
// modules/finance/repositories/TransactionRepository.ts
async findById(id: string): Promise<TransactionEntity | null> {
  const raw = await prisma.transaction.findUnique({ where: { id } });
  if (!raw) return null;
  return TransactionMapper.toDomain(raw); // 🔄 Konversi di sini
}
```

### Langkah 4: Service (Refactoring)

Service menjadi lebih bersih karena logic pindah ke Domain.

**Sebelum:**

```typescript
// Service penuh validasi if-else
async approveTransaction(id: string) {
  const tx = await repo.findById(id);
  if (tx.status === 'PAID') throw new Error('Already paid'); // ❌ Logic bocor
  await repo.update(id, { status: 'PAID' });
}
```

**Sesudah:**

```typescript
// Service hanya orkestrasi
async approveTransaction(id: string) {
  const tx = await repo.findById(id); // Returns TransactionEntity
  tx.approve(); // ✅ Panggil Domain Method
  await repo.save(tx); // Simpan perubahan
}
```

## 3. Rekomendasi Implementasi

Jangan ubah semua sekaligus! Mulailah dari **modul yang paling kompleks logic-nya** (misalnya `Finance` atau `Inventory`). Modul CRUD sederhana (seperti `FAQ` atau `Announcement`) mungkin tidak butuh kompleksitas ini ("Over-engineering").

**Urutan Eksekusi:**

1. Buat folder `domain` dan `mappers` di dalam `modules/finance/`.
2. Pindahkan logic validasi dari `FinanceService.ts` ke `TransactionEntity`.
3. Update `TransactionRepository` untuk menggunakan Mapper.
