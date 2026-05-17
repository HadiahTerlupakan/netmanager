import {
  findPelangganBasic,
  findProrateLogs,
  type ProrateLogRecord,
} from "../repositories/ProrateLogRepository";

const PRORATE_LOG_LIMIT = 50;

export interface ProrateLogResult {
  pelanggan: { id: string; nama: string };
  logs: ProrateLogRecord[];
}

export class PelangganNotFoundError extends Error {
  constructor() {
    super("Pelanggan tidak ditemukan");
    this.name = "PelangganNotFoundError";
  }
}

interface GetProrateLogParams {
  pelangganId: string;
  /** Bila true, abaikan filter tenant (super admin saja). */
  isSuperAdmin: boolean;
  /** Tenant aktif untuk filter (wajib bila bukan super admin). */
  tenantId: string | null;
}

/**
 * Ambil riwayat prorate payment untuk satu pelanggan dalam scope tenant aktif.
 *
 * Defense in depth: tenant filter di-spread ke setiap query repository agar
 * tidak tergantung satu titik enforcement.
 */
export async function getPelangganProrateLog(
  params: GetProrateLogParams,
): Promise<ProrateLogResult> {
  const { pelangganId, isSuperAdmin, tenantId } = params;
  const tenantIdFilter = isSuperAdmin ? undefined : tenantId!;

  const pelanggan = await findPelangganBasic({
    pelangganId,
    tenantId: tenantIdFilter,
  });

  if (!pelanggan) {
    throw new PelangganNotFoundError();
  }

  const logs = await findProrateLogs({
    pelangganId,
    tenantId: tenantIdFilter,
    limit: PRORATE_LOG_LIMIT,
  });

  return {
    pelanggan: { id: pelanggan.id, nama: pelanggan.nama },
    logs,
  };
}
