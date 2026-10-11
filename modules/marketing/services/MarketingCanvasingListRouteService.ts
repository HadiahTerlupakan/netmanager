import { ZodError } from "zod";
import { hasCapability } from "@/lib/permission-aliases";
import { LingkupSalesService } from "@/modules/presurvei";
import { ErrorCodes, type ErrorCode } from "@/lib/api";
import { hasMobilePermission } from "@/lib/mobile-auth";
import {
  getCanvasingValidationMessage,
  parseCanvasingStatusParam,
  parseCreateCanvasingInput,
} from "../validators/canvasingValidation";
import type { CanvasingListSummaryEntity } from "../domain/entities/CanvasingEntity";
import type {
  CanvasingDetailDTO,
  CanvasingListItemDTO,
} from "../dto/MarketingDTO";
import { createCanvasingService } from "./marketing-service-factories";
import type { CanvasingService } from "./CanvasingService";

type CanvasingStatusValue = "PENDING" | "APPROVED" | "REJECTED";

const EMPTY_LIST_SUMMARY: CanvasingListSummaryEntity = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  pendingClaims: 0,
};

export interface CanvasingListRouteSession {
  id: string;
  /** Wajib untuk menurunkan lingkup tim; `verifyAuth` selalu menyediakannya. */
  tenantId?: string | null;
  role?: string | null;
  permissions?: string[];
  siteId?: string | null;
  siteIds?: string[];
}

export interface CanvasingListRouteInput {
  session: CanvasingListRouteSession;
  permissions: string[];
  isSuperAdmin: boolean;
  status?: string | null;
  salesId?: string | null;
  siteId?: string | null;
  search?: string | null;
  page: number;
  limit: number;
  cursor?: string | null;
}

export interface CanvasingCreateRouteInput {
  session: CanvasingListRouteSession;
  permissions: string[];
  isSuperAdmin: boolean;
  body: Record<string, unknown>;
}

export interface CanvasingListPayload {
  data: CanvasingListItemDTO[];
  total: number;
  page: number;
  limit: number;
  nextCursor: string | null;
  summary: CanvasingListSummaryEntity;
}

export type CanvasingListRouteResult<T> =
  | { success: true; data: T; status?: number }
  | {
      success: false;
      status: number;
      error: string;
      code?: ErrorCode;
    };

export type CanvasingListRouteFailure = Extract<
  CanvasingListRouteResult<unknown>,
  { success: false }
>;

export function isCanvasingListRouteFailure<T>(
  result: CanvasingListRouteResult<T>,
): result is CanvasingListRouteFailure {
  return !result.success;
}

const PERAN_MITRA = "MITRA";

/** Sesi milik mitra eksternal — id-nya ada di database mitra, bukan `User`. */
function isSesiMitra(session: CanvasingListRouteSession): boolean {
  return session.role === PERAN_MITRA;
}

/**
 * Atribusi pembuat canvasing. Mitra eksternal memakai kolom `mitraId`;
 * `salesId` ber-FK ke `User`, jadi id mitra di sana membuat insert gagal
 * (`canvasing_salesId_fkey`). Ditulis dari sesi, bukan dari badan permintaan,
 * supaya komisi tidak bisa dialihkan ke mitra lain.
 */
function atribusiPembuat(session: CanvasingListRouteSession): {
  salesId: string | null;
  mitraId: string | null;
} {
  return isSesiMitra(session)
    ? { mitraId: session.id, salesId: null }
    : { salesId: session.id, mitraId: null };
}

function emptyListPayload(page: number, limit: number): CanvasingListPayload {
  return {
    data: [],
    total: 0,
    page,
    limit,
    nextCursor: null,
    summary: { ...EMPTY_LIST_SUMMARY },
  };
}

/**
 * Route service untuk list & create canvasing — menampung permission/site
 * scope yang tadinya nempel di route handler, sehingga handler tinggal jadi
 * thin controller (sejalan dengan MarketingCanvasingDetailRouteService).
 */
// Dibuat saat dipakai, bukan saat modul diimpor: instansiasi di tingkat modul
// ikut membangun repository (dan klien Prisma) hanya karena file ini disentuh
// graf impor, yang membuat modul ini tidak bisa diimpor di lingkungan tes.
let lingkupSalesTersimpan: LingkupSalesService | undefined;
function lingkupSales(): LingkupSalesService {
  lingkupSalesTersimpan ??= new LingkupSalesService();
  return lingkupSalesTersimpan;
}

export class MarketingCanvasingListRouteService {
  private serviceInstance?: CanvasingService;

  constructor(service?: CanvasingService) {
    this.serviceInstance = service;
  }

  private get service() {
    if (!this.serviceInstance) {
      this.serviceInstance = createCanvasingService();
    }
    return this.serviceInstance;
  }

  async list(
    input: CanvasingListRouteInput,
  ): Promise<CanvasingListRouteResult<CanvasingListPayload>> {
    if (
      isSesiMitra(input.session) &&
      !hasMobilePermission(input.permissions, "m_canvasing:read")
    ) {
      // Mitra teknisi tidak punya fitur canvasing; tanpa gerbang ini ia tetap
      // menerima 200 karena lingkup mempersempit datanya ke miliknya sendiri.
      return {
        success: false,
        status: 403,
        error: "Anda tidak memiliki akses ke data canvasing",
      };
    }

    try {
      const status = parseCanvasingStatusParam(input.status ?? null);
      const canReadAll =
        input.isSuperAdmin ||
        hasCapability(input.permissions, "canvasing:read") ||
        hasCapability(input.permissions, "canvasing:verify");
      const canVerify = hasCapability(input.permissions, "canvasing:verify");
      const canViewOthers = input.isSuperAdmin || canVerify || canReadAll;
      const isSiteRestricted =
        !input.isSuperAdmin &&
        input.permissions.includes("canvasing:site_only");

      let salesId = input.salesId ?? undefined;
      let salesIds: string[] | undefined;
      let mitraId: string | undefined;
      const filterSiteId = input.siteId ?? undefined;
      let restrictSiteIds: string[] | undefined;

      if (!canViewOthers && isSesiMitra(input.session)) {
        // Canvasing mitra tersimpan di `mitraId`. Lewat lingkup sales ia akan
        // disaring sebagai `salesId = id mitra` dan mitra tidak pernah melihat
        // kirimannya sendiri.
        salesId = undefined;
        salesIds = undefined;
        mitraId = input.session.id;
      } else if (!canViewOthers) {
        // Kepala sales melihat canvasing timnya; sales biasa hanya miliknya.
        // Lingkupnya satu definisi dengan rencana dan prospek.
        // Izin canvasing sudah menolak melihat milik orang lain, jadi lingkup
        // sales di sini hanya boleh mempersempit. Dipakai varian yang tak
        // pernah menjawab "tanpa batas".
        const lingkup = await lingkupSales().idSalesTerlihatTanpaMelebarkan({
          penggunaId: input.session.id,
          tenantId: input.session.tenantId,
          permissions: input.permissions,
        });

        if (lingkup.length === 1) {
          salesId = lingkup[0];
          salesIds = undefined;
        } else {
          salesId = undefined;
          salesIds = lingkup;
        }
      } else if (isSiteRestricted) {
        const allowedSiteIds = input.session.siteIds ?? [];
        if (allowedSiteIds.length === 0) {
          return {
            success: true,
            data: emptyListPayload(input.page, input.limit),
          };
        }
        if (filterSiteId && !allowedSiteIds.includes(filterSiteId)) {
          return {
            success: true,
            data: emptyListPayload(input.page, input.limit),
          };
        }
        if (!filterSiteId) {
          restrictSiteIds = allowedSiteIds;
        }
      }

      const filterParams: {
        status?: CanvasingStatusValue;
        salesId?: string;
        salesIds?: string[];
        mitraId?: string;
        siteId?: string;
        siteIds?: string[];
        search?: string;
      } = {};

      if (status) filterParams.status = status as CanvasingStatusValue;
      if (salesId) filterParams.salesId = salesId;
      if (salesIds) filterParams.salesIds = salesIds;
      if (mitraId) filterParams.mitraId = mitraId;
      if (filterSiteId) {
        filterParams.siteId = filterSiteId;
      } else if (restrictSiteIds) {
        filterParams.siteIds = restrictSiteIds;
      }

      const trimmedSearch = input.search?.trim();
      if (trimmedSearch) filterParams.search = trimmedSearch;

      const result = await this.service.getAllRequests(
        filterParams,
        input.page,
        input.limit,
        { cursor: input.cursor ?? undefined },
      );

      return {
        success: true,
        data: {
          data: result.data,
          total: result.total,
          page: input.page,
          limit: input.limit,
          nextCursor: result.nextCursor ?? null,
          summary: result.summary,
        },
      };
    } catch (error) {
      return mapCanvasingListError(error, "Gagal mengambil data canvasing");
    }
  }

  async create(
    input: CanvasingCreateRouteInput,
  ): Promise<CanvasingListRouteResult<CanvasingDetailDTO>> {
    if (!canCreateCanvasing(input)) {
      return {
        success: false,
        status: 403,
        error: "Anda tidak memiliki akses untuk membuat data canvasing",
      };
    }

    try {
      const payload = parseCreateCanvasingInput({
        ...input.body,
        ...atribusiPembuat(input.session),
      });
      const created = await this.service.createRequest(payload);
      return { success: true, data: created, status: 201 };
    } catch (error) {
      return mapCanvasingListError(error, "Gagal membuat data canvasing");
    }
  }
}

function canCreateCanvasing(input: CanvasingCreateRouteInput): boolean {
  if (input.isSuperAdmin) return true;
  if (hasCapability(input.permissions, "canvasing:create")) return true;
  return hasMobilePermission(input.permissions, "m_canvasing:create");
}

function mapCanvasingListError(
  error: unknown,
  fallback: string,
): CanvasingListRouteResult<never> {
  if (error instanceof ZodError) {
    return {
      success: false,
      status: 400,
      error: getCanvasingValidationMessage(error),
      code: ErrorCodes.VALIDATION_ERROR,
    };
  }

  const message = error instanceof Error ? error.message : fallback;
  return { success: false, status: 500, error: message };
}

export const marketingCanvasingListRouteService =
  new MarketingCanvasingListRouteService();
