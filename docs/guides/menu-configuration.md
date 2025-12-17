# Menu Configuration Guide

Dokumentasi ini menjelaskan cara menambahkan, mengubah, atau menghapus menu di admin portal NetManager.

## Overview

Menu di admin portal dikonfigurasi secara manual melalui satu file config:

```
lib/menu-config.ts
```

File ini adalah **single source of truth** untuk:
- Sidebar di admin portal
- Daftar menu di Role Permission Matrix (saat membuat/edit role)

## Struktur Menu Config

```typescript
interface MenuConfig {
  code: string           // Unique identifier (untuk permissions)
  name: string           // Nama yang ditampilkan
  path: string | null    // Route path, null jika hanya container
  icon?: string          // Nama icon dari react-icons/hi2
  children?: MenuConfig[] // Submenu items
  exact?: boolean        // Match path persis (untuk dashboard)
}
```

## Cara Menambahkan Menu Baru

### 1. Parent Menu (Menu Utama)

Buka file `lib/menu-config.ts` dan tambahkan entry baru di array `ADMIN_MENU_CONFIG`:

```typescript
export const ADMIN_MENU_CONFIG: MenuConfig[] = [
  // ... existing menus ...
  
  // Tambahkan menu baru di sini:
  {
    code: 'LAPORAN',           // Kode unik (UPPERCASE, underscore)
    name: 'Laporan',           // Nama yang ditampilkan
    path: '/admin/laporan',    // Path route
    icon: 'HiOutlineDocumentChartBar', // Icon dari react-icons/hi2
  },
]
```

### 2. Menu dengan Submenu

```typescript
{
  code: 'LAPORAN',
  name: 'Laporan',
  path: '/admin/laporan',
  icon: 'HiOutlineDocumentChartBar',
  children: [
    { 
      code: 'LAPORAN.HARIAN',      // Format: PARENT.CHILD
      name: 'Laporan Harian', 
      path: '/admin/laporan/harian', 
      icon: 'HiOutlineCalendar' 
    },
    { 
      code: 'LAPORAN.BULANAN', 
      name: 'Laporan Bulanan', 
      path: '/admin/laporan/bulanan', 
      icon: 'HiOutlineChartPie' 
    },
  ],
},
```

### 3. Update Sidebar Icons

Setelah menambahkan menu, pastikan icon sudah diimport di `components/layout/Sidebar.tsx`:

```typescript
import {
  // ... existing imports ...
  HiOutlineDocumentChartBar,  // Tambahkan import icon baru
  HiOutlineChartPie,
} from 'react-icons/hi2'
```

Kemudian update mapping icon di sidebar (jika perlu).

## Konvensi Penamaan

### Kode Menu (code)
- Gunakan UPPERCASE
- Gunakan underscore untuk spasi
- Format submenu: `PARENT.CHILD`
- Contoh: `NETWORK`, `NETWORK.MIKROTIK`, `FINANCE.TAGIHAN`

### Path
- Selalu dimulai dengan `/admin/`
- Gunakan lowercase
- Gunakan dash untuk spasi
- Contoh: `/admin/laporan/harian`, `/admin/bank-accounts`

### Icon
- Gunakan icon dari `react-icons/hi2` (Heroicons 2)
- Format: `HiOutline{IconName}`
- Referensi: https://react-icons.github.io/react-icons/icons/hi2/

## Contoh Lengkap: Menambahkan Menu "Notifikasi"

### Step 1: Edit `lib/menu-config.ts`

```typescript
// Tambahkan di ADMIN_MENU_CONFIG:
{
  code: 'NOTIFIKASI',
  name: 'Notifikasi',
  path: '/admin/notifikasi',
  icon: 'HiOutlineBell',
  children: [
    { 
      code: 'NOTIFIKASI.EMAIL', 
      name: 'Email', 
      path: '/admin/notifikasi/email', 
      icon: 'HiOutlineEnvelope' 
    },
    { 
      code: 'NOTIFIKASI.WHATSAPP', 
      name: 'WhatsApp', 
      path: '/admin/notifikasi/whatsapp', 
      icon: 'HiOutlineChatBubbleLeftRight' 
    },
    { 
      code: 'NOTIFIKASI.PUSH', 
      name: 'Push Notification', 
      path: '/admin/notifikasi/push', 
      icon: 'HiOutlineDevicePhoneMobile' 
    },
  ],
},
```

### Step 2: Buat Halaman Route

```bash
# Buat folder dan file page
mkdir -p app/admin/notifikasi
touch app/admin/notifikasi/page.tsx

mkdir -p app/admin/notifikasi/email
touch app/admin/notifikasi/email/page.tsx

# ... dst untuk submenu lainnya
```

### Step 3: Restart Dev Server

```bash
npm run dev
```

### Step 4: Assign Permission ke Role

1. Buka halaman `/admin/roles`
2. Edit role yang diinginkan
3. Centang permission "Notifikasi" dan submenu yang diperlukan
4. Save role

## Menghapus Menu

1. Hapus entry dari `ADMIN_MENU_CONFIG` di `lib/menu-config.ts`
2. (Opsional) Hapus folder route dari `app/admin/`
3. Restart dev server

## Tips

1. **Urutan Menu**: Menu ditampilkan sesuai urutan di array `ADMIN_MENU_CONFIG`
2. **Permission Parent**: Jika user memiliki permission parent (contoh: `NETWORK`), mereka otomatis punya akses ke semua submenu (`NETWORK.MIKROTIK`, dll)
3. **Dashboard Routes**: Gunakan `exact: true` untuk route dashboard agar tidak overlap dengan submenu

## File Terkait

| File | Deskripsi |
|------|-----------|
| `lib/menu-config.ts` | Config utama menu |
| `components/layout/Sidebar.tsx` | Sidebar admin portal |
| `hooks/usePermissions.ts` | Hook untuk permission matrix |
| `components/roles/PermissionMatrixEditor.tsx` | UI permission matrix |

## Troubleshooting

### Menu tidak muncul di Sidebar
- Pastikan user memiliki permission untuk menu tersebut
- Check console browser untuk error permission

### Menu tidak muncul di Role Permission
- Pastikan menu sudah ditambahkan di `lib/menu-config.ts`
- Restart dev server setelah edit config

### Icon tidak tampil
- Pastikan icon sudah diimport di `Sidebar.tsx`
- Cek nama icon benar (case-sensitive)
