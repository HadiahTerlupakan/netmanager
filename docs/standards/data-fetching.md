# Data Fetching Standard

> **Status**: Adopted (2026-05-17)
> **Library**: TanStack Query v5 (`@tanstack/react-query`)
> **Hook utama**: `useApi` di `lib/hooks/useApi.ts`
> **Provider**: `QueryClientProvider` di `components/providers/session-provider.tsx`
> **DevTools**: `@tanstack/react-query-devtools` (auto-enabled di development)

## Mengapa TanStack Query

Project ini adalah **superapp** dengan kompleksitas tinggi: customer portal, admin panel, employee portal, mitra portal, finance, attendance, work-order, inventory, marketing, network management, real-time integration. Untuk skala segini, kebutuhan data fetching melebihi GET sederhana:

- **Mutation patterns** banyak (POST/DELETE/PUT untuk hampir setiap entity)
- **Query invalidation cross-module** (mutate customer → invalidate invoices, dashboard, dll)
- **Optimistic updates** dibutuhkan di UI critical (finance, attendance)
- **DevTools** krusial untuk debug cache state di multi-tenant SaaS
- **Infinite queries** untuk customer/work-order/transaction lists
- **Stale-while-revalidate** untuk dashboard real-time tanpa flash loading

TanStack Query menyediakan semua di atas first-class. Bundle ~13 KB extra worth it untuk fitur-fitur ini.

Project Next.js + React 19 dengan plugin React Compiler (via `eslint-config-next` 16) **tidak menerima** pola lama "fetch on mount via `useEffect`" karena:

1. `react-hooks/no-access-before-declaration` — function-after-useEffect = TDZ
2. `react-hooks/set-state-in-effect` — setState dalam useEffect cascade-render

Pola lama yang melanggar:

```tsx
// ❌ JANGAN
const [data, setData] = useState<X[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetchData(); // TDZ violation
}, []);

const fetchData = async () => {
  const res = await fetch("/api/foo");
  setData(await res.json()); // set-state-in-effect via call chain
  setLoading(false);
};
```

TanStack Query menyelesaikan keduanya: deklaratif (tidak ada effect manual) + caching/dedup/revalidation/devtools/mutation-first-class otomatis.

## Pattern Standar

### 1. GET sederhana — pakai `useApi`

```tsx
import { useApi } from "@/lib/hooks/useApi";

const { data, error, isLoading, mutate } = useApi<UserProfile>("/api/user/profile");

if (isLoading) return <PageLoader />;
if (error) return <ErrorBanner message={error.message} />;
```

### 2. Conditional fetch

Gunakan `null` sebagai key untuk skip fetch.

```tsx
const { data } = useApi<Ticket>(
  isAuthenticated && ticketId ? `/api/tickets/${ticketId}` : null,
);
```

### 3. Mutation + invalidation (sederhana)

Setelah POST/PUT/DELETE, panggil `mutate()` untuk invalidate & re-fetch.

```tsx
const handleDelete = async (id: string) => {
  const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
  if (res.ok) {
    toast.success("Deleted");
    await mutate(); // Invalidate & re-fetch
  }
};
```

### 4. Optimistic update via `mutate(updater, { revalidate: false })`

Update local cache tanpa fetch — UI snappy:

```tsx
mutate(
  (prev) => {
    if (!prev) return prev;
    return prev.map((it) => (it.id === id ? { ...it, status: "DONE" } : it));
  },
  { revalidate: false },
);
```

### 5. Multiple endpoints di 1 komponen

Pakai `useApi` beberapa kali — biarkan TanStack Query handle dedup & paralel fetch:

```tsx
const { data: sites } = useApi<Site[]>("/api/sites");
const { data: groups } = useApi<Group[]>("/api/groups");
const { data: members } = useApi<Member[]>(
  selectedGroupId ? `/api/groups/${selectedGroupId}/members` : null,
);
```

### 6. Search dengan debounce

Pakai `useDebounce` untuk input, lalu pasang ke key URL:

```tsx
const [search, setSearch] = useState("");
const debouncedSearch = useDebounce(search, 500);

const { data } = useApi<Item[]>(
  isOpen ? `/api/items?search=${encodeURIComponent(debouncedSearch)}` : null,
);
```

### 7. `useMutation` untuk POST/PUT/DELETE complex

Kalau butuh state mutation eksplisit (loading/error per-action) atau optimistic dengan rollback:

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";

const queryClient = useQueryClient();
const deleteUser = useMutation({
  mutationFn: (id: string) =>
    fetch(`/api/users/${id}`, { method: "DELETE" }).then((r) => r.json()),
  onMutate: async (id) => {
    // Optimistic: hapus dari cache sebelum server confirm
    await queryClient.cancelQueries({ queryKey: ["/api/users"] });
    const prev = queryClient.getQueryData<User[]>(["/api/users"]);
    queryClient.setQueryData<User[]>(["/api/users"], (old) =>
      old?.filter((u) => u.id !== id),
    );
    return { prev };
  },
  onError: (_err, _id, ctx) => {
    // Rollback on error
    if (ctx?.prev) queryClient.setQueryData(["/api/users"], ctx.prev);
    toast.error("Gagal menghapus user");
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/users"] });
  },
});

// Pemakaian:
deleteUser.mutate(userId);
```

### 8. Infinite list (work-order, customer, transaction)

```tsx
import { useInfiniteQuery } from "@tanstack/react-query";

const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ["customers", searchQuery],
  queryFn: ({ pageParam = 1 }) =>
    apiFetcher(`/api/customers?page=${pageParam}&search=${searchQuery}`),
  getNextPageParam: (last) => last.nextPage ?? undefined,
  initialPageParam: 1,
});
```

## Pattern Pengganti `useEffect` (untuk pola yang bukan fetch)

### Pola A: Sync prop ke local state → derive selama render

```tsx
// ❌ SEBELUM
const [logoSrc, setLogoSrc] = useState(...);
useEffect(() => { setLogoSrc(propLogo); }, [propLogo]);

// ✅ SESUDAH
const logoSrc = propLogo;
```

### Pola C: Reset state on prop change → prevProp comparator

React 19 official pattern: setState selama render diperbolehkan dengan guard berdasarkan prev state.

```tsx
// ❌ SEBELUM
useEffect(() => {
  if (isOpen) {
    setStep(1);
    setForm(initialForm);
  }
}, [isOpen]);

// ✅ SESUDAH
const [prevOpen, setPrevOpen] = useState(isOpen);
if (isOpen !== prevOpen) {
  setPrevOpen(isOpen);
  if (isOpen) {
    setStep(1);
    setForm(initialForm);
  }
}
```

### Pola D: Side effect non-state (router, scroll, focus, websocket)

`useEffect` masih valid untuk side effect external yang **bukan** setState:

```tsx
// ✅ TETAP PAKAI useEffect
useEffect(() => {
  if (!authLoading && !isAuthenticated) router.push("/login");
}, [authLoading, isAuthenticated, router]);

useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
}, [replies]);

useEffect(() => {
  const subscription = subscribe(channel, handler);
  return () => subscription.unsubscribe();
}, [channel]);
```

### Pola E: fetchOnMount sederhana → `hasFetched` comparator (kalau tidak pakai useApi)

Untuk hook yang memang harus pakai pattern fetch+setState manual (mis. ada race-condition guard):

```tsx
const [hasFetched, setHasFetched] = useState(false);
if (!hasFetched) {
  setHasFetched(true);
  void fetchData();
}
```

### Pola F: filter-based fetch → `fetchKey` comparator

```tsx
const [prevFetchKey, setPrevFetchKey] = useState<string | null>(null);
const fetchKey = `${page}|${search}|${filter}`;
if (prevFetchKey !== fetchKey) {
  setPrevFetchKey(fetchKey);
  void fetchData();
}
```

### Pola G: Date.now() / Math.random() during render → `useState` lazy init

```tsx
// ❌ SEBELUM (impure)
const [tempId] = useState<string>(`temp-${Date.now()}`);

// ✅ SESUDAH (lazy init via callback)
const [tempId] = useState<string>(() => `temp-${Date.now()}`);
```

## Fetcher Default

`apiFetcher` di `lib/hooks/useApi.ts` adalah wrapper di atas `fetchWithHandling` (`lib/utils/fetch-wrapper.ts`):

- Auto-parse response JSON
- Throw `FetchError` (struktur `{ status, message, details, retryAfter }`)
- Unwrap `{ success, data }` envelope dari API standard project
- Konsisten dengan rate-limit & error handling existing

## QueryClient Defaults

Di `components/providers/session-provider.tsx`:

```tsx
new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,    // Tidak revalidate saat tab focus
      retry: false,                    // Tidak retry otomatis on error
      staleTime: 30_000,               // Cache fresh 30 detik
    },
  },
});
```

Override per-call jika butuh:

```tsx
useApi("/api/dashboard", {
  refreshInterval: 30_000,        // Polling 30 detik
  staleTime: 0,                   // Selalu refetch on mount
});
```

## DevTools

`ReactQueryDevtools` aktif di development. Buka panel di kiri-bawah untuk:

- Lihat semua active queries dan cache
- Inspect query state (idle/loading/success/error)
- Manual invalidate / refetch
- Track stale time, gc time, fetch time
- Lihat structured query data

## Don'ts

- ❌ JANGAN pakai `eslint-disable react-hooks/set-state-in-effect` — itu menutup masalah
- ❌ JANGAN bungkus setState di `setTimeout` untuk akali rule
- ❌ JANGAN duplikasi data TanStack Query ke `useState` lokal — selalu derive
- ❌ JANGAN call `mutate()` di useEffect tanpa guard — bisa loop
- ❌ JANGAN buat QueryClient di module scope — buat di Provider via `useState(() => new QueryClient(...))`

## Lihat juga

- [TanStack Query v5 Docs](https://tanstack.com/query/latest)
- [React 19 — You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- `docs/CHANGELOG.md` — catatan migrasi per fase
