# Transaction & Consistency Strategy

## When to Use Transactions

- Multi-table writes yang harus atomic (invoice + payment + items)
- Balance updates (increment + decrement harus atomic)
- State transitions dengan side effects (approve leave → update balance → sync attendance)
- Cascade operations (delete parent + children)

## Transaction Pattern

```typescript
// Good: Atomic operation
await prisma.$transaction(async (tx) => {
  const invoice = await tx.invoice.create({ data: invoiceData });
  await tx.payment.create({ data: { invoiceId: invoice.id, ...paymentData } });
  await tx.invoiceItem.createMany({ data: items.map(i => ({ ...i, invoiceId: invoice.id })) });
});

// Bad: Non-atomic (data corruption risk)
const invoice = await prisma.invoice.create({ data: invoiceData }); // ❌ Bisa gagal di sini
await prisma.payment.create({ data: paymentData }); // ❌ Invoice sudah created tapi payment gagal
```

## Consistency Levels

- **Strong consistency**: Gunakan transaction untuk critical operations (payment, balance, approval)
- **Eventual consistency**: Gunakan events untuk non-critical side effects (notification, logging, analytics)
- **Read-your-writes**: Pastikan user bisa baca data yang baru dia tulis (avoid stale cache)

## Transaction Guidelines

- Transaction timeout default: 5 seconds
- Long-running operations: max 30 seconds (avoid jika bisa)
- Jika operation > 30s: pecah jadi background job dengan queue
- Nested transaction: gunakan `tx` parameter, jangan buat transaction baru di dalam transaction

## Pagination Standard

### Unified Pagination Pattern

```typescript
// Request params
type PaginationParams = {
  page?: number;        // 1-based (default: 1)
  limit?: number;       // items per page (default: 20, max: 100)
  sortBy?: string;      // field name (e.g., "createdAt", "name")
  sortOrder?: 'asc' | 'desc'; // default: 'desc'
};

// Response envelope
type PaginatedResponse<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};
```

### When to Use Which

- **Offset pagination**: Admin dashboards, reports, data tables (predictable page numbers)
- **Cursor pagination**: Infinite scroll, real-time feeds, mobile apps (better performance for large datasets)
