import { logger } from "@/lib/logger";

/**
 * Default COA code mapping per accounting event purpose.
 *
 * Setiap kode di sini WAJIB:
 *  - Ada di DEFAULT_COA (modules/accounting/services/coa/ChartOfAccountService.ts)
 *  - isPostable = true (tidak boleh akun header)
 *
 * Test verifikasi: tests/accounting/coa-mapping-config.test.ts
 */
const DEFAULT_COA_MAPPING = {
  // Aset Lancar — Kas & Bank
  KAS_UTAMA: "1-110",
  BANK_UTAMA: "1-120",
  KAS_KECIL: "1-130",

  // Aset Lancar — Piutang & Persediaan
  PIUTANG_KARYAWAN: "1-150",
  PIUTANG_USAHA: "1-200",
  PERSEDIAAN: "1-280",

  // Kewajiban
  UTANG_USAHA: "2-100",
  UTANG_PAJAK: "2-200",
  UTANG_GAJI: "2-350",
  UTANG_BPJS: "2-360",
  UTANG_PPH_21: "2-400",
  HUTANG_INVESTOR: "2-600",

  // Ekuitas
  MODAL_DISETOR: "3-100",
  LABA_DITAHAN: "3-200",
  LABA_RUGI_BERJALAN: "3-300",

  // Pendapatan
  PENDAPATAN_JASA: "4-100",
  POTONGAN_KUPON: "4-300",

  // Beban
  BEBAN_GAJI: "5-100",
  BEBAN_BPJS: "5-110",
  BEBAN_BANDWIDTH: "5-200",
  BEBAN_OPERASIONAL: "5-500",
  BEBAN_PENYUSUTAN: "5-400",
  BEBAN_LAINNYA: "5-500",
  BEBAN_MITRA: "5-800",
  BEBAN_INVESTOR: "5-810",
} as const;

export type CoaPurpose = keyof typeof DEFAULT_COA_MAPPING;

const tenantOverrideCache = new Map<string, Map<CoaPurpose, string>>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const cacheTimestamps = new Map<string, number>();

function isCacheValid(tenantId: string): boolean {
  const ts = cacheTimestamps.get(tenantId);
  if (!ts) return false;
  return Date.now() - ts < CACHE_TTL_MS;
}

/**
 * Load tenant-specific COA overrides.
 * TODO: Implement when AccountingCoaMapping Prisma model is added.
 * For now returns empty map (all tenants use defaults).
 */
async function loadTenantOverrides(
  _tenantId: string,
): Promise<Map<CoaPurpose, string>> {
  return new Map();
}

/**
 * Resolve COA code untuk purpose tertentu.
 * Cek override cache dulu, fallback ke default.
 */
export async function getCoaCode(
  tenantId: string,
  purpose: CoaPurpose,
): Promise<string> {
  let overrides = tenantOverrideCache.get(tenantId);

  if (!overrides || !isCacheValid(tenantId)) {
    overrides = await loadTenantOverrides(tenantId);
    tenantOverrideCache.set(tenantId, overrides);
    cacheTimestamps.set(tenantId, Date.now());
  }

  const overrideCode = overrides.get(purpose);
  if (overrideCode) {
    return overrideCode;
  }

  return DEFAULT_COA_MAPPING[purpose];
}

export function getDefaultCoaCode(purpose: CoaPurpose): string {
  return DEFAULT_COA_MAPPING[purpose];
}

export function listCoaPurposes(): CoaPurpose[] {
  return Object.keys(DEFAULT_COA_MAPPING) as CoaPurpose[];
}

export function invalidateCoaMappingCache(tenantId: string): void {
  tenantOverrideCache.delete(tenantId);
  cacheTimestamps.delete(tenantId);
  logger.info(`[CoaMappingConfig] Cache invalidated for tenant ${tenantId}`);
}
