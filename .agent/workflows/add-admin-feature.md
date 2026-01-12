---
description: Standard workflow for adding a new Admin Feature with Menu and RBAC
---

# Add Admin Feature Workflow

## Checklist

```
[ ] 1. Define Resource Capabilities (resource-capabilities.ts)
[ ] 2. Define Permission Group (permission-config.ts)
[ ] 3. Define Menu Item (menu-config.ts)
[ ] 4. Create Page with ensurePermission
[ ] 5. Create API with hasPermission
[ ] 6. Verify Icon in Sidebar
[ ] 7. Register Permission via Role Settings UI
[ ] 8. Test Access Control
```

---

## ⚠️ CRITICAL: Permission Architecture

> **Session NextAuth TIDAK menyimpan permissions** (untuk mengurangi ukuran cookie).
> Permissions di-load dari database saat runtime!

| Layer                     | File                      | Cara Load Permission                             |
| ------------------------- | ------------------------- | ------------------------------------------------ |
| **Server (Page)**         | `lib/rbac.ts`             | `hasPermission()` → `getUserPermissions(userId)` |
| **Server (API)**          | `lib/rbac.ts`             | `hasPermission()` → `getUserPermissions(userId)` |
| **Client (Sidebar/Hook)** | `hooks/use-permission.ts` | Fetch dari `/api/user/permissions`               |

**Files yang terlibat:**

- `lib/auth.ts` → `getUserPermissions(userId)` - Load dari database
- `lib/rbac.ts` → `hasPermission()`, `ensurePermission()` - Server-side check
- `hooks/use-permission.ts` → Client-side hook, fetch dari API
- `app/api/user/permissions/route.ts` → API endpoint untuk client

---

## Step 1: Define Resource Capabilities

**File**: `lib/resource-capabilities.ts`

Tambahkan resource baru dengan actions yang tersedia:

```typescript
// Tambahkan di RESOURCE_CAPABILITIES object
your_resource: {
    actions: ['read', 'create', 'update', 'delete', 'site_only'],
    description: 'Deskripsi fitur Anda'
},
```

**Actions tersedia**:

- `read` - Melihat data
- `create` - Membuat data baru
- `update` - Mengubah data
- `delete` - Menghapus data
- `site_only` - Restricsi per site
- `department_only` - Restricsi per department
- `verify` - Untuk approval/rejection

---

## Step 2: Define Permission Group

**File**: `lib/permission-config.ts`

> ⚠️ **CRITICAL**: Resource HARUS ditambahkan di sini agar muncul di Role Matrix UI!

Tambahkan resource ke group yang sesuai di `PERMISSION_GROUPS`:

```typescript
// Append ke existing group ATAU buat group baru
GROUP_NAME: ['existing_resource', 'your_resource'],
```

**Contoh**: Menambah `sales_dashboard` ke group MARKETING:

```typescript
MARKETING: ['marketing', 'coupon', 'sales_dashboard', 'sales', 'canvasing'],
```

---

## Step 3: Define Menu Item

**File**: `lib/menu-config.ts`

Tambahkan entry ke `ADMIN_MENU_CONFIG`:

```typescript
{
    code: 'GROUP_NAME.YOUR_RESOURCE',  // Maps to your_resource:read
    name: 'Nama Menu',
    path: '/admin/path/to/page',
    icon: 'HiOutlineIconName'          // Dari react-icons/hi2
}
```

**Naming Convention**:

- Parent Code: `GROUP_NAME` → maps to `group_name:read`
- Child Code: `GROUP_NAME.RESOURCE` → maps to `resource:read`
- Use snake_case for resource name in code

---

## Step 4: Create Page with Server-Side Protection

**File**: `app/admin/path/to/page.tsx`

```tsx
import { ensurePermission } from "@/lib/rbac";
import YourClientComponent from "./YourClientComponent";

export default async function YourPage() {
  await ensurePermission("your_resource:read");
  return <YourClientComponent />;
}
```

---

## Step 5: Create API with Permission Check

**File**: `app/api/path/to/route.ts`

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  const session = await requireAdmin(request);
  if (session instanceof NextResponse) return session;

  // Permission check
  if (!(await hasPermission("your_resource:read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ... your logic
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin(request);
  if (session instanceof NextResponse) return session;

  if (!(await hasPermission("your_resource:create"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ... your logic
}
```

---

## Step 6: Verify Sidebar Icon

**File**: `components/layout/Sidebar.tsx`

Pastikan icon yang digunakan di `menu-config.ts` sudah ada di `IconMap`:

```typescript
import { HiOutlineYourIcon } from "react-icons/hi2";

const IconMap: Record<string, React.ElementType> = {
  // ... existing icons
  HiOutlineYourIcon,
};
```

---

## Step 7: Register Permission via UI

1. Buka **Admin Portal > Settings > Roles**
2. Edit role yang diinginkan (misal: Administrator)
3. Permission baru akan muncul di bagian group yang sesuai
4. Centang permission yang diperlukan
5. Klik **Simpan** → Permission otomatis dibuat di database

> ℹ️ Tidak perlu menjalankan script migration atau seed database.

---

## Step 8: Test Access Control

| Test Case                           | Expected Result                          |
| ----------------------------------- | ---------------------------------------- |
| Login sebagai Super Admin           | Menu muncul, bisa akses                  |
| Login sebagai user TANPA permission | Menu TIDAK muncul                        |
| Akses langsung URL tanpa permission | Redirect/blocked oleh `ensurePermission` |
| API call tanpa permission           | Return 403 Forbidden                     |

---

## Quick Reference

| File                            | Purpose                                    |
| ------------------------------- | ------------------------------------------ |
| `lib/resource-capabilities.ts`  | Define available actions per resource      |
| `lib/permission-config.ts`      | Group resources untuk Role Matrix UI       |
| `lib/menu-config.ts`            | Define menu structure                      |
| `lib/rbac.ts`                   | `ensurePermission()` dan `hasPermission()` |
| `components/layout/Sidebar.tsx` | Icon mapping                               |

---

## Common Mistakes

1. ❌ Lupa tambah resource di `resource-capabilities.ts`
2. ❌ **Lupa tambah resource di `permission-config.ts`** → Resource tidak muncul di Role Matrix!
3. ❌ Menu code tidak match dengan resource name
4. ❌ Lupa protect API route dengan `hasPermission()`
5. ❌ Typo di nama permission (case-sensitive, use snake_case)
6. ❌ **Menggunakan `session.user.permissions`** → Session TIDAK menyimpan permissions!
7. ❌ Lupa gunakan `await getUserPermissions(userId)` di server-side code

---

## Troubleshooting

### Menu Tampil tapi Halaman Tidak Bisa Dibuka

**Penyebab**: `lib/rbac.ts` menggunakan `session.user.permissions` yang selalu kosong.

**Solusi**: Pastikan `lib/rbac.ts` menggunakan `getUserPermissions(userId)` dari `@/lib/auth`:

```typescript
import { authConfig, getUserPermissions } from "@/lib/auth";

export async function hasPermission(requiredPermission: string) {
  const session = await getServerSession(authConfig);
  if (!session?.user) return false;
  if (session.user.role === "SUPER_ADMIN") return true;

  // WAJIB: Load dari database!
  const permissions = await getUserPermissions(session.user.id);
  return permissions.includes(requiredPermission);
}
```
