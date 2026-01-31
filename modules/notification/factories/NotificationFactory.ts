/**
 * NotificationFactory
 *
 * Factory pattern for creating notifications with different channels.
 */

import type { CreateNotificationDTO, SendPushNotificationDTO } from '../dto/NotificationDTO'

export interface NotificationPayload {
    userId: string
    title: string
    message: string
    type: string
    data?: Record<string, unknown>
    channels: ('IN_APP' | 'PUSH' | 'WHATSAPP' | 'EMAIL')[]
}

export class NotificationFactory {
    /**
     * Create work order notification
     */
    static createWorkOrderNotification(dto: {
        userId: string
        workOrderNumber: string
        action: 'ASSIGNED' | 'UPDATED' | 'COMPLETED' | 'CANCELLED'
    }): NotificationPayload {
        const actionMessages: Record<string, { title: string; message: string }> = {
            ASSIGNED: {
                title: 'Work Order Baru',
                message: `Anda mendapat work order baru: ${dto.workOrderNumber}`,
            },
            UPDATED: {
                title: 'Work Order Diupdate',
                message: `Work order ${dto.workOrderNumber} telah diupdate`,
            },
            COMPLETED: {
                title: 'Work Order Selesai',
                message: `Work order ${dto.workOrderNumber} telah selesai`,
            },
            CANCELLED: {
                title: 'Work Order Dibatalkan',
                message: `Work order ${dto.workOrderNumber} telah dibatalkan`,
            },
        }

        const { title, message } = actionMessages[dto.action]

        return {
            userId: dto.userId,
            title,
            message,
            type: 'WORK_ORDER',
            data: {
                workOrderNumber: dto.workOrderNumber,
                action: dto.action,
            },
            channels: ['IN_APP', 'PUSH'],
        }
    }

    /**
     * Create payment reminder notification
     */
    static createPaymentReminder(dto: {
        userId: string
        pelangganName: string
        amount: number
        dueDate: string
        phoneNumber?: string
    }): NotificationPayload {
        const formattedAmount = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
        }).format(dto.amount)

        return {
            userId: dto.userId,
            title: 'Pengingat Pembayaran',
            message: `Tagihan ${formattedAmount} jatuh tempo pada ${dto.dueDate}`,
            type: 'PAYMENT_REMINDER',
            data: {
                pelangganName: dto.pelangganName,
                amount: dto.amount,
                dueDate: dto.dueDate,
            },
            channels: dto.phoneNumber ? ['IN_APP', 'PUSH', 'WHATSAPP'] : ['IN_APP', 'PUSH'],
        }
    }

    /**
     * Create attendance notification
     */
    static createAttendanceNotification(dto: {
        userId: string
        type: 'CHECK_IN' | 'CHECK_OUT' | 'LATE' | 'ABSENT'
        time?: string
    }): NotificationPayload {
        const typeMessages: Record<string, { title: string; message: string }> = {
            CHECK_IN: {
                title: 'Check In Berhasil',
                message: `Anda telah check in pada ${dto.time}`,
            },
            CHECK_OUT: {
                title: 'Check Out Berhasil',
                message: `Anda telah check out pada ${dto.time}`,
            },
            LATE: {
                title: 'Keterlambatan Tercatat',
                message: `Anda tercatat terlambat pada ${dto.time}`,
            },
            ABSENT: {
                title: 'Tidak Hadir',
                message: 'Anda tidak hadir hari ini',
            },
        }

        const { title, message } = typeMessages[dto.type]

        return {
            userId: dto.userId,
            title,
            message,
            type: 'ATTENDANCE',
            data: {
                attendanceType: dto.type,
                time: dto.time,
            },
            channels: ['IN_APP'],
        }
    }

    /**
     * Create salary notification
     */
    static createSalaryNotification(dto: {
        userId: string
        period: string
        status: 'PROCESSED' | 'APPROVED' | 'PAID'
        netSalary?: number
    }): NotificationPayload {
        const statusMessages: Record<string, { title: string; message: string }> = {
            PROCESSED: {
                title: 'Slip Gaji Diproses',
                message: `Slip gaji periode ${dto.period} sedang diproses`,
            },
            APPROVED: {
                title: 'Slip Gaji Disetujui',
                message: `Slip gaji periode ${dto.period} telah disetujui`,
            },
            PAID: {
                title: 'Gaji Telah Dibayar',
                message: `Gaji periode ${dto.period} telah ditransfer`,
            },
        }

        const { title, message } = statusMessages[dto.status]

        return {
            userId: dto.userId,
            title,
            message,
            type: 'SALARY',
            data: {
                period: dto.period,
                status: dto.status,
                netSalary: dto.netSalary,
            },
            channels: ['IN_APP', 'PUSH'],
        }
    }

    /**
     * Create system announcement
     */
    static createAnnouncement(dto: {
        userId: string
        title: string
        content: string
    }): NotificationPayload {
        return {
            userId: dto.userId,
            title: dto.title,
            message: dto.content.substring(0, 200),
            type: 'ANNOUNCEMENT',
            data: {
                fullContent: dto.content,
            },
            channels: ['IN_APP', 'PUSH'],
        }
    }

    // ==================== Channel-specific payloads ====================

    /**
     * Convert to in-app notification DTO
     */
    static toInAppDTO(payload: NotificationPayload): CreateNotificationDTO {
        return {
            userId: payload.userId,
            title: payload.title,
            message: payload.message,
            type: payload.type,
            data: payload.data,
        }
    }

    /**
     * Convert to push notification DTO
     */
    static toPushDTO(payload: NotificationPayload): SendPushNotificationDTO {
        return {
            userId: payload.userId,
            title: payload.title,
            body: payload.message,
            data: payload.data,
        }
    }
}
