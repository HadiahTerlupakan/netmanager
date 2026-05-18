# Idempotency Middleware — Apply Guide

**Status:** Middleware siap di `lib/api/idempotency.ts`. Apply ke endpoint mutation mobile butuh dilakukan per modul.

## Endpoint yang WAJIB di-apply (urut prioritas)

| Endpoint | File | Risk replay | Ada `requestId`? |
|----------|------|-------------|------------------|
| `POST /api/mobile/inventory/masuk` | `app/api/mobile/inventory/masuk/route.ts` | Stok ganda (financial) | Belum — perlu mobile inject |
| `POST /api/mobile/inventory/keluar` | `app/api/mobile/inventory/keluar/route.ts` | Stok ganda (financial) | Belum |
| `POST /api/mobile/work-orders/*` (create/update) | berbagai | Duplicate WO | Belum |
| `POST /api/mobile/leaves` | `app/api/mobile/leaves/route.ts` | Cuti dihitung 2x | Belum |
| `POST /api/mobile/overtime` | route serupa | Lembur dihitung 2x | Belum |

## Pattern apply

```ts
import { idempotencyService, resolveIdempotencyKey, ApiErrors, apiSuccess } from "@/lib/api";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";

export async function POST(request: NextRequest) {
  const auth = await getMobileAuthPayload(request);
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const requestId = resolveIdempotencyKey(
    request.headers.get("Idempotency-Key"),
    body?.requestId,
  );

  const outcome = await idempotencyService.execute({
    scope: "inventory:masuk",
    userId: auth.id,
    requestId,
    payload: body,
    handler: async () => {
      // Logika bisnis asli — pemanggilan service / Prisma
      const result = await inventoryService.recordBarangMasuk({ ...body, userId: auth.id });
      return result; // serializable
    },
  });

  switch (outcome.kind) {
    case "fresh":
    case "no-key": // legacy: tidak kirim Idempotency-Key, tetap allow
      return apiSuccess(outcome.response);
    case "replay":
      return apiSuccess(outcome.response, {
        headers: { "X-Idempotent-Replay": "true" },
      });
    case "in-progress":
      return ApiErrors.conflict("Permintaan masih diproses, tunggu sebentar");
    case "hash-mismatch":
      return ApiErrors.conflict(
        "Idempotency-Key sudah dipakai untuk payload berbeda",
      );
    case "unavailable":
      return ApiErrors.serviceUnavailable(
        "Layanan idempotency tidak tersedia, silakan coba lagi",
      );
  }
}
```

## Mobile-side wajib

1. `useApiMutation` perlu generalisasi `createAttendanceRequestId` → `createRequestId(scope)` dan auto-inject ke semua mutation. Lihat `src/utils/attendanceIdempotency.ts` sebagai referensi.
2. SyncService replay sudah pass `Idempotency-Key` header dari `requestId` queue meta — tinggal generalize ke non-attendance.
3. Pakai `expo-crypto.randomUUID()` daripada `Math.random()` untuk hindari clock-rollback collision.

## Test wajib per endpoint

1. Submit dengan requestId X → 200 fresh
2. Submit ulang requestId X dengan payload sama → 200 replay (header `X-Idempotent-Replay: true`, response identical)
3. Submit requestId X dengan payload beda → 409 hash-mismatch
4. Submit tanpa requestId → 200 fresh (legacy compat, log warning)
5. Redis down → 503 unavailable
6. 2 request paralel requestId X → 1 fresh, 1 in-progress (409)

## Catatan TTL

Default 24h match SyncService TTL. Untuk endpoint yang allowed offline > 24h (work-order completion bisa berhari-hari), pertimbangkan TTL lebih panjang (3-7 hari).
