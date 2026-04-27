import { randomUUID } from "crypto";

import { prisma } from "@/modules/database";
import { createNotification } from "@/modules/notification";

import {
  filterEligibleReminderRecipients,
  shouldSendRabReminder,
} from "../utils/rab-approval-reminder";
import { createRouteServiceError } from "./RouteServiceError";

const REMINDER_COOLDOWN_MINUTES = 30;

export class RabApprovalReminderRouteService {
  /** Send reminder notification to pending RAB approvers. */
  async sendReminder(rabId: string, userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    const isSuperAdmin = !!user?.role?.isSuperAdmin;
    const hasAccess = isSuperAdmin || !!user?.role?.canApproveRab;

    if (!hasAccess) {
      throw createRouteServiceError(
        "Tidak memiliki akses mengirim reminder approval",
        403,
      );
    }

    const rab = await prisma.rabProject.findUnique({
      where: { id: rabId },
      include: {
        creator: { select: { id: true, name: true } },
        approvals: { select: { userId: true, createdAt: true } },
      },
    });

    if (!rab) {
      throw createRouteServiceError("RAB tidak ditemukan", 404);
    }

    if (rab.status !== "PENDING_APPROVAL" && rab.status !== "DRAFT") {
      throw createRouteServiceError(
        "Reminder hanya dapat dikirim pada status DRAFT atau PENDING_APPROVAL",
        400,
      );
    }

    const lastReminder = await prisma.notifications.findFirst({
      where: {
        sourceType: "RAB_APPROVAL_REMINDER",
        sourceId: rabId,
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const canSendReminder = shouldSendRabReminder({
      now: new Date(),
      lastReminderAt: lastReminder?.createdAt ?? null,
      cooldownMinutes: REMINDER_COOLDOWN_MINUTES,
    });

    if (!canSendReminder) {
      throw createRouteServiceError(
        "Reminder sudah dikirim baru-baru ini, coba lagi beberapa menit lagi",
        409,
      );
    }

    const approverUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { role: { canApproveRab: true } },
          { role: { isSuperAdmin: true } },
        ],
      },
      select: {
        id: true,
        name: true,
      },
    });
    const recipientIds = filterEligibleReminderRecipients({
      candidateApproverIds: approverUsers.map((approver) => approver.id),
      approvedUserIds: rab.approvals.map((approval) => approval.userId),
      creatorUserId: rab.creator?.id,
    });

    if (recipientIds.length === 0) {
      throw createRouteServiceError(
        "Tidak ada approver yang perlu diingatkan",
        400,
      );
    }

    const statusText =
      rab.status === "DRAFT"
        ? "Draft menunggu approval pertama"
        : "Masih menunggu persetujuan lanjutan";

    await Promise.all(
      recipientIds.map((recipientId) =>
        createNotification({
          type: "ALERT",
          priority: "HIGH",
          title: `Reminder Approval RAB: ${rab.name}`,
          message: `${statusText}. Mohon review RAB ${rab.name} segera agar proses lapangan tidak tertunda.`,
          link: "/admin/integrations/mixradius/expenses",
          userId: recipientId,
          sourceType: "RAB_APPROVAL_REMINDER",
          sourceId: rabId,
        }),
      ),
    );

    return {
      id: randomUUID(),
      rabId,
      sentCount: recipientIds.length,
    };
  }
}
