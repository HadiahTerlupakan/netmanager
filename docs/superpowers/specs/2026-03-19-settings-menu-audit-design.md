# Audit Menu Pengaturan Design

## Goal
Melakukan audit menyeluruh terhadap seluruh menu Pengaturan di panel admin untuk memastikan fungsionalitas, keamanan (multi-tenant & encryption), dan konsistensi UI/UX.

## Audit Scope
1. **Umum**: Konfigurasi dasar sistem.
2. **Hak Akses (Roles)**: Manajemen peran dan izin (dialihkan ke `/admin/settings/roles`).
3. **Logo**: Pengaturan branding visual.
4. **Email**: Konfigurasi SMTP/Email service.
5. **WhatsApp**: Integrasi gateway pesan.
6. **Payment Gateway**: Konfigurasi pembayaran online.
7. **API**: Pengaturan endpoint atau kunci API eksternal.
8. **Nada Dering**: Pengaturan notifikasi suara.
9. **ACS & Vendor**: Pengaturan sistem manajemen perangkat.
10. **Versi App**: Manajemen versi aplikasi mobile.
11. **Backup Database**: Fungsi pemeliharaan data.

## Audit Criteria
- **UI/UX Consistency**: Penggunaan komponen shadcn/ui, loading states, dan error handling.
- **Security**: Verifikasi field `encrypted: true` untuk data sensitif (API keys, password).
- **Multi-tenancy**: Memastikan `tenantId` terisolasi dengan benar di setiap query.
- **Form Validation**: Penggunaan Zod untuk validasi input di client dan server.
- **Permissions**: Memastikan menu hanya bisa diakses oleh user dengan role yang sesuai.

## Proposed Sub-Agents Strategy
1. **Auditor UI/UX**: Fokus pada `app/admin/pengaturan/**/*.tsx`.
2. **Auditor Security & Logic**: Fokus pada `api/settings` dan model database.
3. **Auditor Permissions**: Memeriksa `lib/permission-config.ts` dan middleware.

## Timeline
- **Phase 1**: Mapping & Discovery (Complete)
- **Phase 2**: Deep Audit per Module (Active)
- **Phase 3**: Recommendation & Fixes (Pending)
