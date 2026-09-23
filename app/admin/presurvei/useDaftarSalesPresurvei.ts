"use client";

import { useQuery } from "@tanstack/react-query";

import type { SalesPresurveiDto } from "@/modules/presurvei/client";

/** Endpoint daftar sales (`app/api/admin/presurvei/sales/route.ts`). */
export const URL_DAFTAR_SALES_PRESURVEI = "/api/admin/presurvei/sales";

const KUNCI_DAFTAR_SALES = "presurvei-daftar-sales";

/** Referensi tunggal untuk "belum ada data", supaya tidak lahir array baru tiap render. */
const TANPA_SALES: readonly SalesPresurveiDto[] = Object.freeze([]);

/** Status dan kode penolakan prospek tanpa tenant (`SalesPresurveiService`). */
const STATUS_HTTP_TIDAK_DAPAT_DIPROSES = 422;
const KODE_PROSPEK_TANPA_TENANT = "PROSPEK_TANPA_TENANT";

/** Penolakan server: prospek acuan tidak bertenant, jadi tak ada calon pemilik. */
class GalatProspekTanpaTenant extends Error {
  constructor() {
    super("Prospek ini tidak bertenant");
    this.name = "GalatProspekTanpaTenant";
  }
}

/** URL daftar sales; dengan prospek acuan, tenant diturunkan server darinya. */
function urlDaftarSales(prospekId: string | undefined): string {
  if (!prospekId) return URL_DAFTAR_SALES_PRESURVEI;
  return `${URL_DAFTAR_SALES_PRESURVEI}?prospekId=${encodeURIComponent(prospekId)}`;
}

/**
 * Kunci cache per sumber tenant. Daftar untuk prospek acuan bisa berasal dari
 * tenant lain (super admin), jadi prospekId wajib ikut di kunci.
 */
function kunciDaftarSales(prospekId: string | undefined): readonly string[] {
  return prospekId
    ? [KUNCI_DAFTAR_SALES, "prospek", prospekId]
    : [KUNCI_DAFTAR_SALES];
}

async function isPenolakanTanpaTenant(respons: Response): Promise<boolean> {
  if (respons.status !== STATUS_HTTP_TIDAK_DAPAT_DIPROSES) return false;
  const badan = (await respons.json().catch((): null => null)) as {
    code?: unknown;
  } | null;
  return badan?.code === KODE_PROSPEK_TANPA_TENANT;
}

async function ambilDaftarSales(
  prospekId: string | undefined,
): Promise<{ data: SalesPresurveiDto[] }> {
  const respons = await fetch(urlDaftarSales(prospekId));
  if (!respons.ok) {
    if (await isPenolakanTanpaTenant(respons)) {
      throw new GalatProspekTanpaTenant();
    }
    throw new Error("Gagal memuat daftar sales");
  }
  return respons.json();
}

/**
 * Keadaan pengambilan daftar sales, dari sudut pandang pemakainya.
 * `tanpa-tenant` hanya muncul untuk prospek acuan yang tidak bertenant.
 */
export type StatusDaftarSales = "memuat" | "gagal" | "siap" | "tanpa-tenant";

/** Daftar sales beserta keadaan pengambilannya. */
export interface KeadaanDaftarSales {
  status: StatusDaftarSales;
  daftar: readonly SalesPresurveiDto[];
}

/**
 * Sales aktif di tenant pemakai — atau di tenant `prospekId` bila diberikan —
 * beserta keadaan pengambilannya.
 *
 * Untuk pemakai yang harus membedakan "gagal dimuat" dari "memang tidak ada
 * sales" — pemilih sales di modal target. Data yang sudah pernah tiba tetap
 * `siap` walau muat ulang di latar gagal: React Query mempertahankan `data`
 * lama bersama `isError`, dan daftar itu masih sah untuk dipilih.
 */
export function useKeadaanDaftarSalesPresurvei(
  prospekId?: string,
): KeadaanDaftarSales {
  const query = useQuery({
    queryKey: kunciDaftarSales(prospekId),
    queryFn: () => ambilDaftarSales(prospekId),
  });

  const daftar = query.data?.data;
  if (Array.isArray(daftar)) return { status: "siap", daftar };
  if (query.error instanceof GalatProspekTanpaTenant) {
    return { status: "tanpa-tenant", daftar: TANPA_SALES };
  }
  if (query.isError) return { status: "gagal", daftar: TANPA_SALES };
  return { status: "memuat", daftar: TANPA_SALES };
}

/**
 * Sales aktif di tenant pemakai, untuk dropdown filter.
 *
 * Selama belum tiba — atau bila gagal — mengembalikan daftar kosong, bukan
 * melempar: pemakainya (`opsiSales`) tetap punya pilihan dari baris yang
 * sedang tampil, jadi layar tidak kehilangan fungsi filternya.
 */
export function useDaftarSalesPresurvei(): readonly SalesPresurveiDto[] {
  return useKeadaanDaftarSalesPresurvei().daftar;
}
