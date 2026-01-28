---
description: Standard untuk handling API response dengan apiSuccess wrapper
---

# API Response Handling Pattern

Semua API di NetManager yang menggunakan `apiSuccess()` mengembalikan format:

```json
{ "success": true, "data": { ... }, "message": "optional" }
```

## WAJIB: Gunakan useApiResponse Hook

```tsx
import { useApiResponse } from "@/hooks/useApiResponse";

function MyComponent() {
  const { data, loading, error, fetchData } = useApiResponse<DataType>();

  useEffect(() => {
    fetchData("/api/admin/endpoint");
  }, []);

  // data sudah otomatis di-extract dari wrapper!
}
```

## Alternatif: Helper Functions

### extractApiData()

```tsx
import { extractApiData } from "@/hooks/useApiResponse";

const res = await fetch("/api/admin/endpoint");
const json = await res.json();
const data = extractApiData<DataType>(json);
```

### apiFetch()

```tsx
import { apiFetch } from "@/hooks/useApiResponse";

const { data, error } = await apiFetch<DataType>("/api/admin/endpoint");
```

## Pattern Manual (jika tidak bisa pakai hook)

```tsx
const res = await fetch("/api/admin/endpoint");
const json = await res.json();
const responseData = json.data || json; // Extract dari wrapper
setData(responseData.items || []);
```

## ⚠️ JANGAN Lakukan Ini

```tsx
// SALAH - langsung akses tanpa extract
const res = await fetch("/api/admin/endpoint");
const data = await res.json();
setItems(data.items); // ❌ undefined! seharusnya data.data.items
```

## Checklist

- [ ] Import useApiResponse dari `@/hooks/useApiResponse`
- [ ] Gunakan hook atau helper function untuk fetch
- [ ] Jangan langsung akses `data.X`, selalu extract dulu
