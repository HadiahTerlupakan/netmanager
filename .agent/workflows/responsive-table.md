---
description: Panduan refactoring tabel ke ResponsiveTable untuk mobile responsiveness
---

# Refactoring Table ke ResponsiveTable

Workflow ini menjelaskan cara mengkonversi tabel HTML standar ke komponen ResponsiveTable yang mobile-friendly.

## Prerequisites

Pastikan komponen `ResponsiveTable` sudah ada di `components/ui/ResponsiveTable.tsx`

## Langkah-langkah

### 1. Import ResponsiveTable

```tsx
import { ResponsiveTable, Column } from "@/components/ui/ResponsiveTable";
```

### 2. Definisikan Columns dengan Prioritas

```tsx
const columns: Column<DataType>[] = [
  {
    key: "name",
    header: "Nama",
    priority: "primary", // Selalu tampil
    render: (item) => <span className="font-bold">{item.name}</span>,
  },
  {
    key: "status",
    header: "Status",
    priority: "secondary", // Hidden pada mobile (<768px)
    render: (item) => <StatusBadge status={item.status} />,
  },
  {
    key: "notes",
    header: "Catatan",
    priority: "tertiary", // Hidden pada tablet (<1024px)
  },
];
```

**Prioritas:**

- `primary` - Data paling penting (nama, ID, status utama) - selalu tampil
- `secondary` - Data pendukung (tanggal, kategori) - hidden di mobile
- `tertiary` - Data tambahan (catatan, metadata) - hidden di tablet dan mobile

### 3. Definisikan renderActions (Optional)

```tsx
const renderActions = (item: DataType) => (
  <>
    <button onClick={() => handleEdit(item.id)}>Edit</button>
    <button onClick={() => handleDelete(item.id)}>Hapus</button>
  </>
);
```

### 4. Ganti Table HTML dengan ResponsiveTable

```tsx
// SEBELUM:
<div className="overflow-x-auto">
  <table className="min-w-full">
    <thead>...</thead>
    <tbody>...</tbody>
  </table>
</div>

// SESUDAH:
<ResponsiveTable
  data={items}
  columns={columns}
  keyField="id"
  loading={isLoading}
  emptyMessage="Tidak ada data"
  loadingMessage="Memuat..."
  renderActions={renderActions}
  onRowClick={(item) => router.push(`/detail/${item.id}`)}
/>
```

### 5. Props ResponsiveTable

| Prop           | Type                   | Required | Deskripsi                   |
| -------------- | ---------------------- | -------- | --------------------------- |
| data           | T[]                    | Ya       | Array data yang ditampilkan |
| columns        | Column<T>[]            | Ya       | Definisi kolom              |
| keyField       | keyof T                | Ya       | Field untuk key unik        |
| loading        | boolean                | Tidak    | State loading               |
| emptyMessage   | string                 | Tidak    | Pesan saat data kosong      |
| loadingMessage | string                 | Tidak    | Pesan saat loading          |
| renderActions  | (item: T) => ReactNode | Tidak    | Render action buttons       |
| onRowClick     | (item: T) => void      | Tidak    | Handler klik row            |

## Tabel yang Sudah Di-refactor

- `components/inventory/BarangTable.tsx`
- `components/inventory/MasukTable.tsx`
- `components/inventory/KeluarTable.tsx`
- `components/inventory/TransferTable.tsx`
- `app/admin/users/UserList.tsx`
- `app/admin/attendance/AttendanceClient.tsx`
- `app/admin/kehadiran/izin/IzinClient.tsx`
- `app/admin/lembur/LemburClient.tsx`
- `app/admin/network/vlan/VlanList.tsx`
- `app/admin/workorders/list/WoListClient.tsx`

## Catatan Penting

1. **Server Components** - Tidak bisa pakai ResponsiveTable langsung karena perlu client-side hooks
2. **Tabel dengan Virtualisasi** - (ONUList, OLTList) perlu pendekatan khusus
3. **Modal dan Photo Preview** - Tetap dipertahankan di luar ResponsiveTable
4. **Pagination** - Tetap handle terpisah di luar ResponsiveTable
