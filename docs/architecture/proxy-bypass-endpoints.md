# Proxy Bypass Endpoints

## Overview

Beberapa endpoint di-bypass dari `proxy.ts` untuk menghindari body cloning overhead atau limit.

## Bypassed Endpoints

### `/api/settings/backup/import`

**Reason:** Upload file backup besar (>10MB) terkena body cloning limit 10MB default Next.js.

**Solution:** Bypass proxy untuk endpoint ini agar request langsung ke route handler tanpa body buffering.

**Security:** Route handler sudah punya auth check via `hasPermission("backup_database:delete")`.

**Added:** 2026-05-08

---

## How Proxy Bypass Works

Endpoint yang di-bypass akan:
1. Skip proxy body cloning
2. Langsung ke route handler
3. Tidak lewat proxy auth check (route handler harus punya auth sendiri)
4. Tidak ada CORS handling dari proxy (route handler handle sendiri jika perlu)

## Adding New Bypass

Jika perlu bypass endpoint lain:

1. Tambahkan kondisi di `proxy.ts`:
   ```typescript
   if (
     pathname === "/api/your/endpoint" || // Reason: ...
     pathname.startsWith("/api") ||
     // ...
   )
   ```

2. Pastikan route handler punya:
   - Auth check sendiri
   - CORS handling jika perlu
   - Input validation

3. Tambahkan test di `tests/ci/backup-import-body-limit.test.ts`

4. Document di file ini
