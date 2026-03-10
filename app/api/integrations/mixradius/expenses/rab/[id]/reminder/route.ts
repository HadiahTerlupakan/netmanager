import { randomUUID } from 'crypto'

import { prisma } from '@/lib/prisma'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import {
  filterEligibleReminderRecipients,
  shouldSendRabReminder,
} from '@/lib/finance/rab-approval-reminder'
import { createNotification } from '@/modules/notification/services/NotificationService'

const REMINDER_COOLDOWN_MINUTES = 30

export const POST = createHandler({ auth: true }, async (_req, ctx) => {
  const userId = ctx.session?.user?.id
  if (!userId) {
    return ApiErrors.unauthorized('Unauthorized')
  }

  const rabId = ctx.params?.id
  if (!rabId) {
    return ApiErrors.badRequest('ID RAB tidak ditemukan')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  })

  const isSuperAdmin = !!user?.role?.isSuperAdmin || ctx.permissions.includes('*')
  const hasAccess = isSuperAdmin
    || !!user?.role?.canApproveRab
    || ctx.permissions.includes('expense:update')
    || ctx.permissions.includes('mixradius_expenses:update')

  if (!hasAccess) {
    return ApiErrors.forbidden('Tidak memiliki akses mengirim reminder approval')
  }

  const rab = await prisma.rabProject.findUnique({
    where: { id: rabId },
    include: {
      creator: { select: { id: true, name: true } },
      approvals: { select: { userId: true, createdAt: true } },
    },
  })

  if (!rab) {
    return ApiErrors.notFound('RAB tidak ditemukan')
  }

  if (rab.status !== 'PENDING_APPROVAL' && rab.status !== 'DRAFT') {
    return ApiErrors.badRequest('Reminder hanya dapat dikirim pada status DRAFT atau PENDING_APPROVAL')
  }

  const lastReminder = await prisma.notifications.findFirst({
    where: {
      sourceType: 'RAB_APPROVAL_REMINDER',
      sourceId: rabId,
    },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })

  const canSendReminder = shouldSendRabReminder({
    now: new Date(),
    lastReminderAt: lastReminder?.createdAt ?? null,
    cooldownMinutes: REMINDER_COOLDOWN_MINUTES,
  })

  if (!canSendReminder) {
    return ApiErrors.conflict('Reminder sudah dikirim baru-baru ini, coba lagi beberapa menit lagi')
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
  })

  const recipientIds = filterEligibleReminderRecipients({
    candidateApproverIds: approverUsers.map((approver) => approver.id),
    approvedUserIds: rab.approvals.map((approval) => approval.userId),
    creatorUserId: rab.creator?.id,
  })

  if (recipientIds.length === 0) {
    return ApiErrors.badRequest('Tidak ada approver yang perlu diingatkan')
  }

  const statusText = rab.status === 'DRAFT' ? 'Draft menunggu approval pertama' : 'Masih menunggu persetujuan lanjutan'

  await Promise.all(recipientIds.map((recipientId) => createNotification({
    type: 'ALERT',
    priority: 'HIGH',
    title: `Reminder Approval RAB: ${rab.name}`,
    message: `${statusText}. Mohon review RAB ${rab.name} segera agar proses lapangan tidak tertunda.`,
    link: '/admin/integrations/mixradius/expenses',
    userId: recipientId,
    sourceType: 'RAB_APPROVAL_REMINDER',
    sourceId: rabId,
  })))

  return apiSuccess({
    id: randomUUID(),
    rabId,
    sentCount: recipientIds.length,
  }, {
    message: `Reminder berhasil dikirim ke ${recipientIds.length} approver`,
  })
})
