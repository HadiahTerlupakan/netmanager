---
description: Panduan lengkap menambahkan RBAC permission untuk fitur/menu baru
---

# Workflow: Add RBAC Permission for New Feature

Panduan ini memastikan implementasi RBAC yang konsisten untuk setiap menu atau sub-menu baru.

## Overview

RBAC di NetManager terdiri dari 3 layer:

1. **Database** - Permission records di tabel `Permission`
2. **Backend** - API route protection dengan `hasPermission()`
3. **Frontend** - Button/action hiding dengan `usePermission()` hook

---

## ⚠️ CRITICAL: Permission Architecture

> **Session NextAuth TIDAK menyimpan permissions** (untuk mengurangi ukuran cookie).
> Permissions HARUS di-load dari database saat runtime!

### Server-Side (lib/rbac.ts)

```typescript
// ✅ BENAR: Load dari database
import { authConfig, getUserPermissions } from "@/lib/auth";

export async function hasPermission(requiredPermission: string) {
  const session = await getServerSession(authConfig);
  if (!session?.user) return false;
  if (session.user.role === "SUPER_ADMIN") return true;

  const permissions = await getUserPermissions(session.user.id);
  return permissions.includes(requiredPermission);
}

// ❌ SALAH: Session tidak punya permissions!
// const permissions = session.user.permissions || []  // SELALU KOSONG!
```

### Client-Side (hooks/use-permission.ts)

```typescript
// Hook fetch permissions dari API /api/user/permissions
const { hasPermission, isLoading } = usePermission();
const canCreate = hasPermission("feature:create");
```

### API Endpoint

`app/api/user/permissions/route.ts` - Endpoint untuk client-side permission loading

---

## Step 1: Define Resource Capabilities

Edit file `lib/resource-capabilities.ts` dan tambahkan resource baru:

```typescript
// Tambahkan di object RESOURCE_CAPABILITIES
'nama_resource': {
  actions: ['read', 'create', 'update', 'delete'], // sesuaikan
  restrictions: ['site_only', 'department_only'],  // opsional
},
```

**Contoh untuk fitur "Laporan Keuangan":**

```typescript
'finance_report': {
  actions: ['read'],  // read-only, tidak ada CRUD
  restrictions: ['site_only', 'department_only'],
},
```

---

## Step 2: Register Permissions (Automatic)

Tidak perlu menjalankan script migration manual. Sistem sekarang memiliki fitur "Self-Healing Permissions".

1.  Login sebagai **SUPER_ADMIN**
2.  Masuk ke **Settings → Roles**
3.  Edit Role (misal: "Administrator")
4.  Centang permission baru yang muncul di list (berdasarkan config di Step 1)
5.  Klik **Simpan**
6.  **Selesai!** Permission otomatis dibuat di database.

---

## Step 3: Protect Backend API Route

Di file API route, tambahkan permission check:

```typescript
// app/api/admin/[feature]/route.ts
import { verifyAuth, hasPermission } from "@/lib/auth";

export async function GET(request: Request) {
  // 1. Verify authentication
  const auth = await verifyAuth();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Check permission
  if (!hasPermission(auth.permissions, "finance_report:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Apply site/department filtering if applicable
  const where: any = {};
  if (
    hasPermission(auth.permissions, "finance_report:site_only") &&
    auth.siteId
  ) {
    where.siteId = auth.siteId;
  }

  // ... rest of logic
}
```

---

## Step 4: Hide Frontend Buttons (PALING PENTING)

### 4a. Import usePermission Hook

```typescript
import { usePermission } from "@/hooks/use-permission";
```

### 4b. Check Permissions di Awal Component

```typescript
export function FeatureClient() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("feature:create");
  const canUpdate = hasPermission("feature:update");
  const canDelete = hasPermission("feature:delete");

  // state declarations...
}
```

### 4c. Wrap Buttons dengan Conditional Rendering

```tsx
{
  /* Header Create Button */
}
{
  canCreate && (
    <button onClick={() => setShowForm(true)}>
      <FiPlus className="h-4 w-4 mr-2" />
      Tambah Data
    </button>
  );
}

{
  /* Table Row Actions */
}
<div className="flex gap-2">
  {canUpdate && (
    <button onClick={() => handleEdit(item)}>
      <FiEdit className="h-4 w-4" />
    </button>
  )}
  {canDelete && (
    <button onClick={() => handleDelete(item.id)}>
      <FiTrash2 className="h-4 w-4" />
    </button>
  )}
</div>;
```

### 4d. Pass Permission ke Child Components

Jika menggunakan komponen terpisah (seperti Table component):

```tsx
// Parent: FeatureList.tsx
<FeatureTable
  data={data}
  onEdit={canUpdate ? handleEdit : undefined}
  onDelete={canDelete ? handleDelete : undefined}
/>;

// Child: FeatureTable.tsx
interface Props {
  data: Feature[];
  onEdit?: (item: Feature) => void; // Optional!
  onDelete?: (id: string) => void; // Optional!
}

export function FeatureTable({ data, onEdit, onDelete }: Props) {
  return (
    <table>
      {data.map((item) => (
        <tr key={item.id}>
          <td>{item.name}</td>
          <td>
            {onEdit && <button onClick={() => onEdit(item)}>Edit</button>}
            {onDelete && (
              <button onClick={() => onDelete(item.id)}>Delete</button>
            )}
          </td>
        </tr>
      ))}
    </table>
  );
}
```

### 4e. Handle Detail Modal dengan Permission

```tsx
// Di modal detail yang punya tombol Edit
<DetailModal
  item={selectedItem}
  isOpen={!!selectedItem}
  onClose={() => setSelectedItem(null)}
  onEdit={canUpdate ? handleEdit : undefined} // Pass undefined jika tidak punya permission
/>
```

---

## Step 5: Update Role Matrix UI (Otomatis)

Jika Step 1 sudah dilakukan dengan benar, Role Matrix di **Settings → Roles** akan otomatis menampilkan permission baru dengan checkbox yang sesuai.

---

## Checklist Implementasi

```markdown
[ ] 1. Tambah resource di `lib/resource-capabilities.ts`
[ ] 2. Insert permission ke database (via script atau Prisma Studio)
[ ] 3. Protect API route dengan hasPermission()
[ ] 4. Import usePermission hook di frontend component
[ ] 5. Declare canCreate/canUpdate/canDelete di awal component
[ ] 6. Wrap Create button dengan {canCreate && (...)}
[ ] 7. Wrap Edit/Delete buttons dengan {canUpdate/canDelete && (...)}
[ ] 8. Pass undefined ke child components jika tidak punya permission
[ ] 9. Test dengan SUPER_ADMIN (semua tombol muncul)
[ ] 10. Test dengan role biasa yang TIDAK punya permission (tombol hilang)
```

---

## Template Code

### Template List Page Component

```tsx
"use client";

import { useState, useEffect } from "react";
import { FiPlus, FiEdit, FiTrash2 } from "react-icons/fi";
import { usePermission } from "@/hooks/use-permission";

export function FeatureListClient() {
  // 1. Permission checks - SELALU di awal
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("feature:create");
  const canUpdate = hasPermission("feature:update");
  const canDelete = hasPermission("feature:delete");

  // 2. State declarations
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // 3. Effects & handlers...

  return (
    <div>
      {/* Header dengan Create button */}
      <div className="flex justify-between">
        <h1>Feature List</h1>
        {canCreate && (
          <button onClick={() => setShowForm(true)}>
            <FiPlus /> Tambah
          </button>
        )}
      </div>

      {/* Table dengan action buttons */}
      <table>
        {data.map((item) => (
          <tr key={item.id}>
            <td>{item.name}</td>
            <td>
              {canUpdate && (
                <button>
                  <FiEdit />
                </button>
              )}
              {canDelete && (
                <button>
                  <FiTrash2 />
                </button>
              )}
            </td>
          </tr>
        ))}
      </table>
    </div>
  );
}
```

---

## Permission Naming Convention

```
Format: [resource]:[action]

Resources: barang, gudang, attendance, workorder, site, department, dll
Actions: read, create, update, delete, site_only, department_only
```

**Contoh:**

- `barang:create` - Membuat barang baru
- `workorder:update` - Mengubah work order
- `attendance:site_only` - Hanya lihat attendance di site sendiri

---

## Quick Reference Files

| Purpose               | File Location                  |
| --------------------- | ------------------------------ |
| Resource Capabilities | `lib/resource-capabilities.ts` |
| Permission Hook       | `hooks/use-permission.ts`      |
| Auth Utilities        | `lib/auth.ts`                  |
| Permission Config     | `lib/permission-config.ts`     |

### Example Files untuk Referensi

| Type            | File                                                   |
| --------------- | ------------------------------------------------------ |
| List Page       | `app/admin/inventory/barang/BarangList.tsx`            |
| Detail Page     | `app/admin/workorders/[id]/WoDetailClient.tsx`         |
| Table Component | `components/inventory/BarangTable.tsx`                 |
| Department List | `app/admin/workorders/departments/DeptIndexClient.tsx` |

---

## Common Mistakes to Avoid

1. ❌ Lupa tambah resource ke `resource-capabilities.ts`
2. ❌ Typo di nama permission (case-sensitive!)
3. ❌ Hanya protect frontend, lupa backend
4. ❌ Lupa pass `undefined` ke child components
5. ❌ Tidak test dengan non-admin user
6. ❌ Lupa user harus re-login setelah permission berubah
7. ❌ **Menggunakan `session.user.permissions`** → Session TIDAK menyimpan permissions!
8. ❌ **Lupa import `getUserPermissions` dari `@/lib/auth`**

---

## Troubleshooting

### Sidebar Menu Kosong / Halaman Tidak Bisa Dibuka

**Penyebab**: Permission diambil dari session yang kosong.

**Solusi**:

1. Pastikan `lib/rbac.ts` menggunakan `getUserPermissions(userId)` dari `@/lib/auth`
2. Pastikan `hooks/use-permission.ts` fetch dari `/api/user/permissions`
3. Pastikan endpoint `/api/user/permissions/route.ts` ada dan bekerja

### Super Admin Tidak Bypass Permission

**Penyebab**: Role check tidak mencakup variasi nama.

**Solusi**: Check kedua format role:

```typescript
if (session.user.role === "SUPER_ADMIN" || session.user.role === "Super Admin")
  return true;
```

---

## Testing Guide

1. **Login sebagai SUPER_ADMIN** → Semua tombol harus muncul
2. **Buka Settings → Roles → Pilih role**
3. **Uncheck permission tertentu** (misal: `feature:create`)
4. **Simpan perubahan**
5. **Force Logout user dengan role tersebut**
6. **Login sebagai user tersebut**
7. **Verify tombol yang di-uncheck sudah TIDAK muncul**
