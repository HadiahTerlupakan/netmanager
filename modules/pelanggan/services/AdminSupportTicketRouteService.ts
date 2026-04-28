import { TicketPriority, TicketStatus } from "@prisma/client";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { buildMultiSiteWhereClause } from "@/modules/roles";
import { UserRepository } from "@/modules/users/repositories/UserRepository";
import { getAdminSupportTicketService } from "./AdminSupportTicketService";

const SUPPORT_READ_PERMISSION = "support:read";
const SUPPORT_SITE_ONLY_PERMISSION = "support:site_only";

type AdminSupportSessionUser = {
  id: string;
  role?: string;
  tenantId?: string | null;
};

interface AdminSupportSession {
  user: AdminSupportSessionUser;
}

interface SupportScopeContext {
  siteId?: string;
  hasSiteRestriction: boolean;
  permissions: string[];
}

interface RouteUserContext {
  id: string;
  role?: string;
  siteId?: string;
}

export class AdminSupportTicketRouteService {
  private readonly ticketService = getAdminSupportTicketService();
  private readonly userRepository = new UserRepository();

  /** Bangun scope akses support ticket berdasarkan permission user. */
  async resolveScope(
    session: AdminSupportSession,
  ): Promise<SupportScopeContext> {
    const permissions = await getUserPermissions(session.user.id);
    const hasSiteRestriction =
      !isSuperAdmin(session.user) &&
      permissions.includes(SUPPORT_SITE_ONLY_PERMISSION);
    if (!hasSiteRestriction) return { hasSiteRestriction, permissions };

    const user = await this.userRepository.findById(session.user.id);
    return {
      siteId: user?.siteId || undefined,
      hasSiteRestriction,
      permissions,
    };
  }

  /** Ambil detail tiket dengan scope akses terhitung. */
  async getTicketById(ticketId: string, session: AdminSupportSession) {
    const scope = await this.resolveScope(session);
    return this.ticketService.getTicketById(
      ticketId,
      this.buildUserContext(session.user, scope),
      scope.hasSiteRestriction,
    );
  }

  /** Perbarui tiket dengan scope akses terhitung. */
  async updateTicket(
    ticketId: string,
    payload: {
      status?: TicketStatus;
      priority?: TicketPriority;
      assignedToId?: string | null;
      closingNote?: string;
    },
    session: AdminSupportSession,
  ) {
    const scope = await this.resolveScope(session);
    return this.ticketService.updateTicket(
      ticketId,
      payload,
      this.buildUserContext(session.user, scope),
      scope.hasSiteRestriction,
    );
  }

  /** Hapus tiket dengan scope akses terhitung. */
  async deleteTicket(ticketId: string, session: AdminSupportSession) {
    const scope = await this.resolveScope(session);
    return this.ticketService.deleteTicket(
      ticketId,
      this.buildUserContext(session.user, scope),
      scope.hasSiteRestriction,
    );
  }

  /** Kirim balasan admin ke tiket support. */
  async replyToTicket(input: {
    ticketId: string;
    senderId: string;
    message?: string;
    updateStatus?: TicketStatus;
    sendWhatsApp?: boolean;
    attachments?: string[];
  }) {
    return this.ticketService.replyToTicket({
      ticketId: input.ticketId,
      senderId: input.senderId,
      message: input.message,
      updateStatus: input.updateStatus,
      sendWhatsApp: input.sendWhatsApp,
      attachments: input.attachments,
    });
  }

  /** Hitung tiket yang membutuhkan perhatian admin. */
  async getUnreadCount(session: AdminSupportSession) {
    const scope = await this.resolveScope(session);
    if (
      !isSuperAdmin(session.user) &&
      !scope.permissions.includes(SUPPORT_READ_PERMISSION)
    ) {
      return {
        ok: false as const,
        error: "Akses ditolak. Anda memerlukan permission: support:read",
      };
    }

    const permissionSession = this.buildPermissionSession(
      session,
      scope.permissions,
    );
    const siteWhere =
      buildMultiSiteWhereClause(permissionSession as never, "support") || {};
    const targetSiteId = Array.isArray(siteWhere.siteId?.in)
      ? siteWhere.siteId.in[0]
      : undefined;
    const result = await this.ticketService.getUnreadCount(targetSiteId);
    return { ok: true as const, ...result };
  }

  /** Bentuk user context untuk service domain support. */
  private buildUserContext(
    user: AdminSupportSessionUser,
    scope: SupportScopeContext,
  ): RouteUserContext {
    return {
      id: user.id,
      ...(user.role !== undefined && { role: user.role }),
      ...(scope.siteId ? { siteId: scope.siteId } : {}),
    };
  }

  /** Bentuk session minimal untuk helper multi-site. */
  private buildPermissionSession(
    session: AdminSupportSession,
    permissions: string[],
  ) {
    return {
      ...session,
      user: {
        ...session.user,
        permissions,
      },
    };
  }
}

export function getAdminSupportTicketRouteService() {
  return new AdminSupportTicketRouteService();
}
