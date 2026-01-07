---
description: Panduan menambahkan RBAC permission untuk fitur atau menu baru
---

# Cara Menambahkan RBAC Permission untuk Fitur Baru

Dokumen ini menjelaskan langkah-langkah untuk mengintegrasikan sistem RBAC saat membuat fitur atau menu baru.

---

## Langkah 1: Tambahkan Permission ke Database

Buat script sementara atau jalankan SQL langsung:

```typescript
// Contoh: add-permission.ts
import { prisma } from "./lib/prisma";
import { randomUUID } from "crypto";

const permissions = [
  { resource: "nama_fitur", action: "read", description: "Melihat data fitur" },
  {
    resource: "nama_fitur",
    action: "create",
    description: "Membuat data baru",
  },
  { resource: "nama_fitur", action: "update", description: "Mengubah data" },
  { resource: "nama_fitur", action: "delete", description: "Menghapus data" },
  {
    resource: "nama_fitur",
    action: "site_only",
    description: "Batasi ke site sendiri",
  },
  {
    resource: "nama_fitur",
    action: "department_only",
    description: "Batasi ke dept sendiri",
  },
];

async function main() {
  for (const perm of permissions) {
    await prisma.permission.create({
      data: {
        id: randomUUID(),
        name: `${perm.resource}:${perm.action}`,
        resource: perm.resource,
        action: perm.action,
        description: perm.description,
        updatedAt: new Date(),
      },
    });
    console.log(`+ ${perm.resource}:${perm.action}`);
  }
}

main().finally(() => prisma.$disconnect());
```

Jalankan: `npx tsx add-permission.ts`

---

## Langkah 2: Daftarkan ke Permission Config

Edit file `lib/permission-config.ts`:

```typescript
export const PERMISSION_GROUPS = {
  // ... existing groups
  KEHADIRAN: ["...", "nama_fitur"], // Tambahkan ke grup yang sesuai
  // atau buat grup baru:
  NAMA_GRUP_BARU: ["nama_fitur"],
};
```

> **Catatan**: Resource harus sama persis dengan yang ada di database.

---

## Langkah 3: Implementasi Permission Check di API

Di API endpoint, tambahkan:

```typescript
import { hasPermission } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  // 1. Auth check
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Permission check
  if (!(await hasPermission("nama_fitur:read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. RBAC Site/Department filter (opsional)
  const user = session.user as any;
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  let filters: any = {};
  if (!isSuperAdmin && user.permissions?.includes("nama_fitur:site_only")) {
    filters.siteId = user.siteId;
  }
  if (
    !isSuperAdmin &&
    user.permissions?.includes("nama_fitur:department_only")
  ) {
    filters.departmentId = user.departmentId;
  }

  // 4. Query dengan filter
  const data = await repository.findAll(filters);
  return NextResponse.json({ data });
}
```

---

## Langkah 4: Deploy ke Production

```bash
# SSH ke server
ssh deploy@SERVER_IP
cd /opt/netmanager

git pull
./deploy.sh update
docker exec -it netmanager-app npx prisma db push
```

---

## Checklist Penambahan Fitur Baru

- [ ] Tambah permission ke database (6 actions: read, create, update, delete, site_only, department_only)
- [ ] Daftarkan resource ke `lib/permission-config.ts`
- [ ] Implementasi `hasPermission()` di semua API endpoint
- [ ] Implementasi filter RBAC jika diperlukan
- [ ] Test di lokal dengan berbagai role
- [ ] Deploy ke production dengan `prisma db push`
