import type { Session } from "next-auth";
import { isSuperAdmin } from "@/lib/auth";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import { UserLookupService } from "@/modules/users";
import { resolveAdminScope } from "./AdminScopeResolver";
import { LocationTrackingService } from "./LocationTrackingService";

const LOCATION_READ_FORBIDDEN_MESSAGE =
  "Anda tidak memiliki akses untuk melihat history lokasi user ini";
const LOCATION_LIVE_FORBIDDEN_MESSAGE =
  "Anda tidak memiliki akses untuk melihat live tracking";

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
  permissions: string[];
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
    const locations = await this.locationService.getLiveLocations(userScope);
    return {
      locations,
      tenantId: session.user.tenantId ?? null,
    };
  }

  /** Ambil history lokasi user sesuai scope permission admin. */
  async getLocationHistory(input: AdminLocationHistoryInput) {
    const dateRange = this.parseDateRange(input.startDate, input.endDate);
    await this.assertCanAccessTargetUser(
      input.session,
      input.permissions,
      input.userId,
    );
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

  private async resolveScope(session: AdminLocationSession) {
    const scope = await resolveAdminScope(
      session.user,
      {
        siteOnly: "live_tracking:site_only",
        departmentOnly: "live_tracking:department_only",
      },
      this.userRepository,
    );

    if (scope.isSuperAdmin) return {};

    if (!scope.siteId && !scope.departmentId) {
      const currentUser = await this.userRepository.findById(session.user.id);
      if (!currentUser) {
        throw new AdminLocationRouteError("Unauthorized", 401);
      }
    }

    return {
      ...(scope.siteId ? { siteId: scope.siteId } : {}),
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

  /**
   * History harus sama ketat dengan live list:
   * - superadmin: lolos
   * - live_tracking:site_only → target.siteId harus = admin.siteId
   * - live_tracking:department_only → target.departmentId harus = admin.departmentId
   * - tanpa restriction flag → tenant-wide (prisma isolation)
   */
  private async assertCanAccessTargetUser(
    session: AdminLocationSession,
    permissions: string[],
    targetUserId: string,
  ): Promise<void> {
    if (isSuperAdmin(session.user)) {
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

    const siteRestricted = permissions.includes("live_tracking:site_only");
    if (siteRestricted) {
      if (!adminUser.siteId || adminUser.siteId !== targetUser.siteId) {
        throw new AdminLocationRouteError(LOCATION_LIVE_FORBIDDEN_MESSAGE, 403);
      }
    }

    const departmentRestricted = permissions.includes(
      "live_tracking:department_only",
    );
    if (departmentRestricted) {
      if (
        !adminUser.departmentId ||
        adminUser.departmentId !== targetUser.departmentId
      ) {
        throw new AdminLocationRouteError(LOCATION_READ_FORBIDDEN_MESSAGE, 403);
      }
    }
  }
}

export {
  AdminLocationRouteError,
  LOCATION_LIVE_FORBIDDEN_MESSAGE,
  LOCATION_READ_FORBIDDEN_MESSAGE,
};
