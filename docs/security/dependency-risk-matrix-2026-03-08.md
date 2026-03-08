# Dependency Risk Matrix - 2026-03-08

Dokumen ini merangkum status keamanan dependency setelah hardening tahap 1-2, termasuk risiko residual yang belum dapat ditutup tanpa perubahan besar pada ekosistem upstream.

## Executive Summary

- Security Status: `LOW RISK (RESIDUAL)`
- Final audit: `8 low`, `0 moderate`, `0 high`, `0 critical`
- Risiko prioritas tinggi/moderat sudah ditutup melalui update dan override dependency.
- Risiko yang tersisa berada pada rantai transitif `firebase-admin` dan saat ini tidak memiliki jalur perbaikan langsung yang aman tanpa perubahan mayor yang tidak sesuai baseline proyek.

## Remediation yang Sudah Diterapkan

- Upgrade `dompurify` ke `^3.3.2`.
- Upgrade `copy-webpack-plugin` ke `^14.0.0`.
- Selaraskan versi Prisma: `prisma`, `@prisma/client`, `@prisma/adapter-pg` ke `^7.4.2`.
- Tambahkan `overrides` untuk:
  - `dompurify: ^3.3.2`
  - `serialize-javascript: ^7.0.4`
  - `@hono/node-server: ^1.19.11`
  - `immutable: ^3.8.3`

## Risk Matrix

| Dependency / Advisory Path | Severity | Current Status | Mitigation in Place | Rationale | Next Action |
| --- | --- | --- | --- | --- | --- |
| `firebase-admin -> @google-cloud/firestore -> google-gax` | Low | Open (Residual) | Tidak ada patch langsung yang aman pada stack saat ini | `npm audit` merekomendasikan perubahan major yang tidak sejalan dengan baseline aktif | Monitor advisory upstream dan evaluasi upgrade saat jalur aman tersedia |
| `firebase-admin -> @google-cloud/storage -> retry-request -> teeny-request` | Low | Open (Residual) | Tidak ada patch langsung yang aman pada stack saat ini | Advisory transitif berada di dependency internal Firebase ecosystem | Pantau release `firebase-admin`/Google Cloud libs dan re-audit berkala |
| `firebase-admin -> teeny-request -> http-proxy-agent -> @tootallnate/once` | Low | Open (Residual) | Isolasi dampak pada dependency transitif | Tidak ada jalur fix non-breaking yang tervalidasi di lock tree saat ini | Jadwalkan review dependency major pada window maintenance berikutnya |

## Verifikasi Teknis

- `npm audit --json`: `8 low`, `0 moderate`, `0 high`, `0 critical`.
- `npm run check`: lulus (`lint`, `typecheck`, `build`).
- `npm run test:run`: lulus (`23 file test`, `360 passed`, `0 failed`).

Catatan: Setelah `npm install`, perlu menjalankan `npm run prisma:generate` agar client Prisma kustom (termasuk `@prisma/client-radius`) tersedia kembali untuk typecheck dan test.

## Monitoring dan Next Steps

1. Jalankan `npm audit --json` secara terjadwal (mis. harian/CI) dan bandingkan delta severity.
2. Pantau release notes `firebase-admin` dan dependency transitif Google Cloud untuk menutup residual low vulnerabilities.
3. Evaluasi upgrade major secara terkontrol hanya pada maintenance window dengan full regression test.
