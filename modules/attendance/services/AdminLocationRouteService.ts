import type { Session } from "next-auth";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import { filterSitePrisma } from "@/modules/roles/client";
import { UserLookupService } from "@/modules/users";
import type { LiveMapUserFilter } from "../domain/entities/LocationTrackingEntity";
import {
  resolveAdminScope,
  scopeTanpaData,
  siteDalamScope,
  type AdminScope,
} from "./AdminScopeResolver";
import { LocationTrackingService } from "./LocationTrackingService";

const LOCATION_READ_FORBIDDEN_MESSAGE =
  "Anda tidak memiliki akses untuk melihat history lokasi user ini";
const LOCATION_LIVE_FORBIDDEN_MESSAGE =
  "Anda tidak memiliki akses untuk melihat live tracking";

/** Permission pembatas live tracking — dipakai live list DAN history. */
const LIVE_TRACKING_SCOPE_KEYS = {
  siteOnly: "live_tracking:site_only",
  departmentOnly: "live_tracking:department_only",
} as const;

interface AdminLocationSession {
  user: Session["user"] & {
    id: string;
    tenantId?: string | null;
  };
}

interface AdminLocationHistoryInput {
  userId: string;
  startDate?: string | null;
  endDate?: string | null;
  session: AdminLocationSession;
}

class AdminLocationRouteError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Service untuk route live tracking dan history lokasi admin. */
export class AdminLocationRouteService {
  private readonly locationService: LocationTrackingService;
  private readonly userRepository: UserLookupService;

  constructor(
    locationService: LocationTrackingService = new LocationTrackingService(),
    userRepository: UserLookupService = new UserLookupService(),
  ) {
    this.locationService = locationService;
    this.userRepository = userRepository;
  }

  /** Ambil lokasi live sesuai scope permission admin. */
  async getLiveLocations(session: AdminLocationSession) {
    const userScope = await this.resolveScope(session);

    // `null` berarti dibatasi tanpa site/departemen: tidak ada karyawan yang
    // boleh dipantau. Meneruskan `{}` ke bawah akan membuka seluruh tenant.
    if (userScope === null) {
      return { locations: [], tenantId: session.user.tenantId ?? null };
    }

    const locations = await this.locationService.getLiveLocations(userScope);
    return {
      locations,
      tenantId: session.user.tenantId ?? null,
    };
  }

  /** Ambil history lokasi user sesuai scope permission admin. */
  async getLocationHistory(input: AdminLocationHistoryInput) {
    const dateRange = this.parseDateRange(input.startDate, input.endDate);
    await this.assertCanAccessTargetUser(input.session, input.userId);
    const [history, stats] = await Promise.all([
      this.locationService.getLocationHistory(
        input.userId,
        dateRange.startDate,
        dateRange.endDate,
      ),
      this.locationService.getLocationStats(
        input.userId,
        dateRange.startDate,
        dateRange.endDate,
      ),
    ]);

    return {
      locations: history,
      stats,
      userId: input.userId,
      dateRange: {
        start: dateRange.startDate.toISOString(),
        end: dateRange.endDate.toISOString(),
      },
    };
  }

  private async resolveScope(
    session: AdminLocationSession,
  ): Promise<LiveMapUserFilter | null> {
    const scope = await this.resolveLiveTrackingScope(session);

    if (scope.isSuperAdmin) return {};

    // Dibatasi tanpa site/departemen berarti tidak ada karyawan yang boleh
    // dipantau. Tanpa cabang ini, lingkupnya jatuh ke `{}` dan posisi real-time
    // seluruh tenant ikut terbuka.
    if (scopeTanpaData(scope)) return null;

    if (!scope.lingkupSite.dibatasi && !scope.departmentId) {
      const currentUser = await this.userRepository.findById(session.user.id);
      if (!currentUser) {
        throw new AdminLocationRouteError("Unauthorized", 401);
      }
    }

    const siteFilter = filterSitePrisma(scope.lingkupSite);
    return {
      ...(siteFilter ? { siteId: siteFilter } : {}),
      ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
    };
  }

  private parseDateRange(startDate?: string | null, endDate?: string | null) {
    const defaultStartDate = toStartOfDay(new Date());
    const defaultEndDate = toEndOfDay(new Date());
    const parsedStartDate = startDate ? new Date(startDate) : defaultStartDate;
    const parsedEndDate = endDate ? new Date(endDate) : defaultEndDate;
    this.assertValidDate(parsedStartDate);
    this.assertValidDate(parsedEndDate);
    return { startDate: parsedStartDate, endDate: parsedEndDate };
  }

  private assertValidDate(date: Date): void {
    if (!Number.isNaN(date.getTime())) {
      return;
    }

    throw new AdminLocationRouteError("Parameter tanggal tidak valid", 400);
  }

  /** Lingkup live tracking admin; satu sumber untuk live list dan history. */
  private resolveLiveTrackingScope(
    session: AdminLocationSession,
  ): Promise<AdminScope> {
    return resolveAdminScope(
      session.user,
      LIVE_TRACKING_SCOPE_KEYS,
      this.userRepository,
    );
  }

  /**
   * History harus sama ketat dengan live list — keduanya memakai
   * `resolveLiveTrackingScope`:
   * - superadmin: lolos
   * - live_tracking:site_only → target.siteId harus salah satu site admin
   *   (seluruh site yang ditugaskan); dibatasi tanpa site → ditolak
   * - live_tracking:department_only → target.departmentId harus = departemen
   *   admin; dibatasi tanpa departemen → ditolak
   * - tanpa restriction flag → tenant-wide (cek tenant di bawah)
   */
  private async assertCanAccessTargetUser(
    session: AdminLocationSession,
    targetUserId: string,
  ): Promise<void> {
    const scope = await this.resolveLiveTrackingScope(session);
    if (scope.isSuperAdmin) {
      return;
    }

    const [adminUser, targetUser] = await Promise.all([
      this.userRepository.findById(session.user.id),
      this.userRepository.findById(targetUserId),
    ]);

    if (!adminUser || !targetUser) {
      throw new AdminLocationRouteError("Unauthorized", 401);
    }

    if (
      adminUser.tenantId &&
      targetUser.tenantId &&
      adminUser.tenantId !== targetUser.tenantId
    ) {
      throw new AdminLocationRouteError(LOCATION_READ_FORBIDDEN_MESSAGE, 403);
    }

    if (!siteDalamScope(scope, targetUser.siteId)) {
      throw new AdminLocationRouteError(LOCATION_LIVE_FORBIDDEN_MESSAGE, 403);
    }

    const isOutsideDepartment =
      scope.tanpaDepartemen ||
      (scope.departmentId !== undefined &&
        scope.departmentId !== targetUser.departmentId);
    if (isOutsideDepartment) {
      throw new AdminLocationRouteError(LOCATION_READ_FORBIDDEN_MESSAGE, 403);
    }
  }
}

export {
  AdminLocationRouteError,
  LOCATION_LIVE_FORBIDDEN_MESSAGE,
  LOCATION_READ_FORBIDDEN_MESSAGE,
};
