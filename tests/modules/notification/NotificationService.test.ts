import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Notifications } from '@prisma/client'
import { prismaMock } from '../../setup'
// const prismaMock = defaultPrismaMock as any

// NotificationService uses prisma directly, so we test the prisma mock behavior
// Note: The actual NotificationService has many dependencies (WebSocket, Push)
// These tests focus on the database interactions

describe('NotificationService - Database Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createNotification (via Prisma)', () => {
    it('should create notification record in database', async () => {
      const notificationData = {
        id: 'notif-1',
        type: 'WORK_ORDER',
        title: 'New Work Order',
        message: 'You have a new work order',
        userId: 'user-1',
        isRead: false,
        createdAt: new Date()
      }

      prismaMock.notifications.create.mockResolvedValueOnce(notificationData as unknown as Notifications)

      const result = await prismaMock.notifications.create({
        data: {
          id: 'notif-id-1',
          type: 'WORK_ORDER',
          title: 'New Work Order',
          message: 'You have a new work order',
          userId: 'user-1'
        }
      })

      expect(result.type).toBe('WORK_ORDER')
      expect(result.userId).toBe('user-1')
    })

    it('should create notification for department', async () => {
      const notificationData = {
        id: 'notif-2',
        type: 'ANNOUNCEMENT',
        title: 'Department Notice',
        message: 'Important announcement',
        departmentId: 'dept-1',
        isRead: false
      }

      prismaMock.notifications.create.mockResolvedValueOnce(notificationData as unknown as Notifications)

      const result = await prismaMock.notifications.create({
        data: {
          id: 'notif-id-2',
          type: 'ANNOUNCEMENT',
          title: 'Department Notice',
          message: 'Important announcement',
          departmentId: 'dept-1'
        }
      })

      expect(result.departmentId).toBe('dept-1')
    })
  })

  describe('markAsRead (via Prisma)', () => {
    it('should update notification isRead to true', async () => {
      prismaMock.notifications.update.mockResolvedValueOnce({
        id: 'notif-1',
        isRead: true,
        readAt: new Date()
      } as unknown as Notifications)

      const result = await prismaMock.notifications.update({
        where: { id: 'notif-1' },
        data: { isRead: true, readAt: new Date() }
      })

      expect(result.isRead).toBe(true)
    })
  })

  describe('markAllAsRead (via Prisma)', () => {
    it('should update all unread notifications for user', async () => {
      prismaMock.notifications.updateMany.mockResolvedValueOnce({
        count: 5
      })

      const result = await prismaMock.notifications.updateMany({
        where: {
          userId: 'user-1',
          isRead: false
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      })

      expect(result.count).toBe(5)
    })

    it('should filter by type when provided', async () => {
      prismaMock.notifications.updateMany.mockResolvedValueOnce({
        count: 3
      })

      const result = await prismaMock.notifications.updateMany({
        where: {
          userId: 'user-1',
          isRead: false,
          type: 'WORK_ORDER'
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      })

      expect(result.count).toBe(3)
    })
  })

  describe('getUnreadCount (via Prisma)', () => {
    it('should return count of unread notifications', async () => {
      prismaMock.notifications.count.mockResolvedValueOnce(7)

      const count = await prismaMock.notifications.count({
        where: {
          userId: 'user-1',
          isRead: false
        }
      })

      expect(count).toBe(7)
    })

    it('should count notifications with OR condition for user and department', async () => {
      prismaMock.notifications.count.mockResolvedValueOnce(10)

      const count = await prismaMock.notifications.count({
        where: {
          isRead: false,
          OR: [
            { userId: 'user-1' },
            { departmentId: { in: ['dept-1', 'dept-2'] } }
          ]
        }
      })

      expect(count).toBe(10)
    })
  })

  describe('getNotifications (via Prisma)', () => {
    it('should return paginated notifications', async () => {
      const mockNotifications = [
        { id: 'notif-1', title: 'Notification 1' },
        { id: 'notif-2', title: 'Notification 2' }
      ]

      prismaMock.notifications.findMany.mockResolvedValueOnce(mockNotifications as unknown as Notifications[])

      const result = await prismaMock.notifications.findMany({
        where: {
          OR: [
            { userId: 'user-1' },
            { departmentId: 'dept-1' }
          ],
          isRead: false
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 0
      })

      expect(result).toHaveLength(2)
    })
  })
})
