# Multi-WhatsApp Permission Fix

**Date:** 2026-05-06  
**Status:** ✅ FIXED

## Issue

User dengan role `admin` tidak bisa akses endpoint Multi-WhatsApp API karena permission `settings:read` dan `settings:write` tidak ada.

**Error Log:**
```
[RBAC] Access Denied. User: 00138dca-4552-4584-97d5-8669eacae3ba, Role: admin, Required: settings:read, Has: 824 perms
GET /api/admin/whatsapp/accounts 403
```

## Root Cause

Permission `settings:read` dan `settings:write` belum dibuat di database dan belum di-assign ke role `admin`.

## Solution

### 1. Create Settings Permissions

```sql
INSERT INTO "Permission" (id, name, action, resource, description, "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid(), 'settings:read', 'read', 'settings', 'Read settings', NOW(), NOW()),
  (gen_random_uuid(), 'settings:write', 'write', 'settings', 'Write settings', NOW(), NOW())
ON CONFLICT (resource, action, "tenantId") DO NOTHING;
```

### 2. Assign to Admin Role

```sql
WITH admin_role AS (
  SELECT id FROM roles WHERE name = 'admin' LIMIT 1
),
settings_perms AS (
  SELECT id FROM "Permission" WHERE resource = 'settings' AND action IN ('read', 'write')
)
INSERT INTO "_PermissionToRole" ("A", "B")
SELECT sp.id, ar.id
FROM settings_perms sp, admin_role ar
ON CONFLICT DO NOTHING;
```

### 3. Clear Permission Cache

```bash
# Clear Redis cache untuk user yang sedang login
docker exec -i netmanager-redis redis-cli DEL "permissions:<user-id>"
```

## Verification

```sql
-- Check total permissions for admin role
SELECT COUNT(*) as total_perms 
FROM "Permission" p 
JOIN "_PermissionToRole" pr ON p.id = pr."A" 
JOIN roles r ON pr."B" = r.id 
WHERE r.name = 'admin';

-- Result: 826 permissions (was 824 before)
```

## User Action Required

Setelah permission ditambahkan dan cache di-clear, user perlu:

1. **Refresh halaman** `/admin/pengaturan/whatsapp`, atau
2. **Logout dan login ulang** untuk reload session dengan permission baru

## Files Modified

- ✅ Database: Added 2 new permissions
- ✅ Database: Assigned permissions to admin role
- ✅ Redis: Cleared permission cache

## Status

**Permission Setup:** ✅ COMPLETE  
**Cache Cleared:** ✅ COMPLETE  
**User Action:** ⏳ PENDING (Refresh/Re-login required)

---

**Next Step:** User harus refresh browser atau re-login untuk menggunakan Multi-WhatsApp API.
