# TanStack Query Adoption Roadmap

> **Status**: Draft — 2026-05-17
> **Library**: `@tanstack/react-query` v5
> **Hook utama**: `useApi` di `lib/hooks/useApi.ts`
> **Provider**: `QueryClientProvider` di `components/providers/session-provider.tsx`
> **DevTools**: `ReactQueryDevtools` (auto-enabled di development)

## Konteks

Project netmanager adalah **superapp** dengan 28 module dan 223 API endpoints, melayani 5 portal (customer, admin, employee, mitra, investor). Setelah migrasi awal di sesi 2026-05-17, foundation TanStack Query sudah ter-pasang tapi adopsi fiturnya baru sebagian:

| Pattern | File | Coverage |
|---|---|---|
| `useApi`/`useQuery` (TanStack-backed) | 37 | **37%** |
| `useEffect + fetch` (pattern lama) | 64 | 63% |
| Manual mutation (`fetch() + mutate()`) | 101 | — |
| Optimistic update via TanStack | **0** | **0%** |
| Polling/SSE manual (`setInterval`/`EventSource`) | 4 | — |
| `useInfiniteQuery` | 0 | 0% |

**Realitas**: bundle ~13 KB sudah dipakai, tapi value baru ~30%. Roadmap ini untuk maksimalkan ROI infrastruktur yang sudah dipasang.

## Goals

1. **UX yang snappy** — optimistic update untuk mutation sehari-hari
2. **Konsistensi data lintas-module** — invalidate cache otomatis setelah mutation
3. **Server load lebih rendah** — pause polling saat tab inactive, dedup request
4. **DX yang lebih baik** — DevTools coverage 100%, debug cache lebih mudah
5. **Mobile-friendly UI** — infinite scroll untuk list besar

## Roadmap Bertahap

### Phase 1: `useMutation` untuk Critical Actions (1-2 minggu)

**Target**: 5 critical mutation flows yang paling sering dipakai admin.

#### Pilot Modules

| Modul | Action | Estimated Effort |
|---|---|---|
| **finance** | Approve/reject manual payment | 4 jam |
| **attendance** | Bulk delete attendance records | 4 jam |
| **work-order** | Update status (in-progress → done) | 4 jam |
| **inventory** | Transfer confirm (stock antar gudang) | 4 jam |
| **pelanggan** | Action menu (delete/isolir/aktivasi) | 4 jam |

**Pattern yang harus dipakai:**

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";

const queryClient = useQueryClient();
const isolirCustomer = useMutation({
  mutationFn: (id: string) =>
    fetch(`/api/pelanggan/${id}/isolir`, { method: "POST" }).then((r) => r.json()),

  // Optimistic update: ubah status di cache sebelum server confirm
  onMutate: async (id) => {
    await queryClient.cancelQueries({ queryKey: ["/api/pelanggan"] });
    const prev = queryClient.getQueryData<Customer[]>(["/api/pelanggan"]);
    queryClient.setQueryData<Customer[]>(["/api/pelanggan"], (old) =>
      old?.map((c) => (c.id === id ? { ...c, status: "ISOLIR" } : c)),
    );
    return { prev };
  },

  // Rollback on error
  onError: (_err, _id, ctx) => {
    if (ctx?.prev) queryClient.setQueryData(["/api/pelanggan"], ctx.prev);
    toast.error("Gagal isolir pelanggan");
  },

  // Settle: invalidate untuk get fresh data dari server
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/pelanggan"] });
  },
});

// Pemakaian:
isolirCustomer.mutate(customerId);
```

#### Acceptance Criteria

- ✅ UI berubah instan saat user klik (tidak menunggu server)
- ✅ Rollback otomatis kalau server return error
- ✅ Loading state per-action (`isolirCustomer.isPending`), bukan global loading
- ✅ Toast feedback success/error tetap muncul
- ✅ Test coverage tetap atau lebih tinggi

#### Estimated Total: 20 jam (1 sprint)

---

### Phase 2: Cross-Module Invalidation (1 minggu)

**Target**: Stop user reload halaman setelah mutation.

#### 5 Cross-Module Invalidation Paling Penting

1. **Customer mutation** → invalidate:
   - `/api/dashboard` (admin overview)
   - `/api/invoices` (billing list)
   - `/api/attendance` (jika customer = employee)

2. **Invoice payment** → invalidate:
   - `/api/customers/:id` (status pembayaran)
   - `/api/finance/reports` (revenue chart)
   - `/api/payment-gateway` (riwayat transaksi)

3. **Work order completion** → invalidate:
   - `/api/dashboard` (KPI cards)
   - `/api/work-orders` (list status)
   - `/api/inventory` (material yang dipakai)

4. **Attendance check-in** → invalidate:
   - `/api/live-map` (real-time location)
   - `/api/payroll/preview` (perhitungan gaji)
   - `/api/dashboard` (active employee count)

5. **Stock transfer** → invalidate:
   - `/api/inventory/dashboard`
   - `/api/work-orders/:id/materials` (jika WO terkait)

#### Pattern

Buat helper di `lib/hooks/useInvalidate.ts`:

```tsx
export function useInvalidateCustomerRelated() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
  };
}
```

#### Estimated Total: 12 jam

---

### Phase 3: Migrate Sisa 64 File ke `useApi` (2-4 minggu, bertahap)

**Target**: Konsistensi infrastruktur. Tidak urgent (kode lama lint-clean dengan pattern E/F), tapi worth it untuk DevTools coverage 100%.

#### Prioritas Migrasi (high → low)

| Modul | File estimasi | Effort | Alasan prioritas |
|---|---|---|---|
| **attendance** | ~12 file | 8 jam | High traffic admin |
| **finance** | ~10 file | 8 jam | Data sensitif, butuh visibility |
| **work-order** | ~10 file | 8 jam | Real-time critical |
| **inventory** | ~8 file | 6 jam | Banyak mutation |
| **pelanggan** | ~6 file | 5 jam | Customer-facing performance |
| **marketing** | ~5 file | 4 jam | List heavy (canvasing, sales) |
| **sisanya** | ~13 file | 10 jam | Catch-all |

#### Pattern Standar

Sudah terdokumentasi di `docs/standards/data-fetching.md`. Migrate file by file dengan:

```tsx
// SEBELUM
const [data, setData] = useState();
const [loading, setLoading] = useState(true);
useEffect(() => { fetch().then(setData).finally(() => setLoading(false)); }, []);

// SESUDAH
const { data, isLoading } = useApi<T>("/api/foo");
```

#### Estimated Total: 49 jam (4-6 sprints distributed)

---

### Phase 4: Polling & Real-time Optimization (1 minggu)

**Target**: Replace 4 manual `setInterval` dengan `refreshInterval` TanStack Query.

#### Files yang Akan Dioptimasi

Audit file yang pakai `setInterval`/`EventSource`:

```bash
grep -rln "setInterval\|EventSource" --include="*.tsx" app/
```

Ada 4 file. Replace dengan:

```tsx
// SEBELUM
useEffect(() => {
  const id = setInterval(fetchLiveData, 15_000);
  return () => clearInterval(id);
}, []);

// SESUDAH
const { data } = useApi('/api/live-map', { refreshInterval: 15_000 });
// Auto-pause saat tab tidak active (TanStack Query default behavior)
```

#### Bonus: SSE Migration

Untuk SSE (Server-Sent Events) di tagihan dashboard, pertimbangkan combine:
- TanStack Query untuk initial fetch + cache
- SSE event listener yang trigger `queryClient.setQueryData()` saat ada update

#### Estimated Total: 8 jam

---

### Phase 5: `useInfiniteQuery` untuk List Besar (1 minggu)

**Target**: Mobile-friendly infinite scroll untuk list dengan banyak data.

#### Kandidat Pertama

| List | Endpoint | Use case |
|---|---|---|
| Customer list (admin) | `/api/pelanggan` | Admin scroll untuk cari customer |
| Work order list | `/api/work-orders` | Field engineer mobile app |
| Invoice list (customer) | `/api/customer/invoices` | Customer history |
| Activity log | `/api/log/activity` | Long timeline |
| Notification feed | `/api/notifications` | Customer + admin |

#### Pattern

```tsx
import { useInfiniteQuery } from "@tanstack/react-query";

const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: ["customers", searchQuery],
  queryFn: ({ pageParam = 1 }) =>
    apiFetcher(`/api/pelanggan?page=${pageParam}&search=${searchQuery}`),
  getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
  initialPageParam: 1,
});

// Render flat list
const items = data?.pages.flatMap((p) => p.data) ?? [];

// Trigger di scroll bottom (Intersection Observer)
<div ref={loadMoreRef}>{isFetchingNextPage && <Spinner />}</div>
```

#### Estimated Total: 16 jam (5 list × ~3 jam)

---

## Total Effort & Timeline

| Phase | Effort | Recommended Window |
|---|---|---|
| 1. useMutation + optimistic | 20 jam | Sprint 1 (2 minggu) |
| 2. Cross-module invalidation | 12 jam | Sprint 2 (1 minggu) |
| 3. Migrate sisa 64 file | 49 jam | Sprint 3-6 (bertahap) |
| 4. Polling optimization | 8 jam | Sprint 7 (1 minggu) |
| 5. Infinite scroll | 16 jam | Sprint 8 (1 minggu) |
| **TOTAL** | **105 jam** | **~10 minggu distributed** |

## Quick Wins yang Bisa Mulai Hari Ini

Tidak perlu tunggu Phase 1 formal. Ini bisa dikerjakan paralel dengan feature work:

1. **Tambah `useApi` untuk fetch baru** — setiap fitur baru, pakai `useApi`. Tidak bertambah pattern lama.
2. **Pakai DevTools** — buka panel kiri-bawah saat development, biasakan inspect cache.
3. **Default `refreshInterval` untuk dashboard** — kalau ada dashboard yang user expect real-time, tambah `{ refreshInterval: 30_000 }`.

## Anti-patterns yang Harus Dihindari

- ❌ Pakai `useState` lokal untuk simpan response API → duplikasi cache
- ❌ Pakai `useEffect` + `fetch` untuk feature baru → menambah utang teknis
- ❌ Manual `setInterval` untuk polling → ada `refreshInterval` built-in
- ❌ Tag invalidation pakai string magic → buat helper hook (`useInvalidateCustomerRelated`)
- ❌ Optimistic update tanpa rollback → bug data divergence
- ❌ Skip `cancelQueries` di `onMutate` → race condition

## Metrics yang Harus Dipantau

Setelah Phase 1-2, pantau:

- **Cache hit ratio** (DevTools → query state) — target ≥70% untuk reusable queries
- **Average time to interactive** untuk mutation — target ≤100ms (instant feedback)
- **Server request count** per session — target turun 30% setelah Phase 1
- **User-reported "data tidak update"** bug — target turun ke 0 setelah Phase 2

## Lihat juga

- `docs/standards/data-fetching.md` — pattern lengkap dengan kode lengkap
- [TanStack Query v5 Migration Guide](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5)
- [Optimistic Update Best Practices](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- `docs/CHANGELOG.md` — catatan migrasi awal sesi 2026-05-17

---

*Last Updated: 2026-05-17*
*Owner: agent (untuk dipindah ke owner manusia saat eksekusi mulai)*
