/**
 * Domain entities untuk module investor.
 *
 * Status saat ini: investor module pakai Prisma model langsung sebagai
 * "domain" (lihat repositories/). File ini menyiapkan namespace untuk
 * future migrasi ke pure domain entities (decoupled dari Prisma).
 *
 * Untuk konsumen yang butuh tipe Investor, gunakan re-export dari `dto/`
 * yang sudah safe (SafeInvestor di InvestorAdminService).
 */

// Future: refactor SafeInvestor → InvestorEntity dengan invariant validation,
// once isolation dari Prisma model dibutuhkan (mis. saat tambah business
// rules yang tidak fit di repository layer).

export {};
