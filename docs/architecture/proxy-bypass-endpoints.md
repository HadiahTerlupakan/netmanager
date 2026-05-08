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
1. **Excluded dari `config.matcher`** - request tidak masuk proxy runtime sama sekali
2. Langsung ke route handler tanpa melewati proxy function
3. Tidak ada body cloning overhead
4. Route handler harus punya auth check sendiri
5. Route handler handle CORS sendiri jika perlu

## Adding New Bypass

Jika perlu bypass endpoint lain:

1. Tambahkan exclusion di `proxy.ts` config.matcher:
   ```typescript
   export const config = {
     matcher: ["/((?!_next/static|_next/image|favicon.ico|api/your/endpoint).*)"],
   };
   ```

2. Pastikan route handler punya:
   - Auth check sendiri
   - CORS handling jika perlu
   - Input validation

3. Tambahkan test di `tests/ci/backup-import-body-limit.test.ts` untuk verify matcher exclusion

4. Document di file ini
