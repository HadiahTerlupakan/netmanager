import type { Session } from "next-auth";
import { isSuperAdmin } from "@/lib/auth";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import { UserLookupService } from "@/modules/users";
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
  async getLiveLocations(session: AdminLocationSession, permissions: string[]) {
    const userScope = await this.resolveScope(session, permissions);
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

  private async resolveScope(
    session: AdminLocationSession,
    permissions: string[],
  ) {
    if (isSuperAdmin(session.user)) {
      return {};
    }

    const currentUser = await this.userRepository.findById(session.user.id);
    if (!currentUser) {
      throw new AdminLocationRouteError("Unauthorized", 401);
    }

    return {
      ...(this.getScopedSiteId(permissions, currentUser.siteId)
        ? { siteId: currentUser.siteId as string }
        : {}),
      ...(this.getScopedDepartmentId(permissions, currentUser.departmentId)
        ? { departmentId: currentUser.departmentId as string }
        : {}),
    };
  }

  private getScopedSiteId(permissions: string[], siteId: string | null) {
    return permissions.includes("live_tracking:site_only") && Boolean(siteId);
  }

  private getScopedDepartmentId(
    permissions: string[],
    departmentId: string | null,
  ) {
    return (
      permissions.includes("live_tracking:department_only") &&
      Boolean(departmentId)
    );
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

    this.assertScopeMatch(permissions, adminUser.siteId, targetUser.siteId);
    this.assertScopeMatch(
      permissions,
      adminUser.departmentId,
      targetUser.departmentId,
      true,
    );
  }

  private assertScopeMatch(
    permissions: string[],
    adminScopeId: string | null,
    targetScopeId: string | null,
    isDepartment = false,
  ): void {
    const permissionName = isDepartment
      ? "live_tracking:department_only"
      : "live_tracking:site_only";
    if (
      !permissions.includes(permissionName) ||
      !adminScopeId ||
      adminScopeId === targetScopeId
    ) {
      return;
    }

    throw new AdminLocationRouteError(
      isDepartment
        ? LOCATION_READ_FORBIDDEN_MESSAGE
        : LOCATION_READ_FORBIDDEN_MESSAGE,
      403,
    );
  }
}

export {
  AdminLocationRouteError,
  LOCATION_LIVE_FORBIDDEN_MESSAGE,
  LOCATION_READ_FORBIDDEN_MESSAGE,
};
