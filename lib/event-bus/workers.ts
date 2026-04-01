import { Worker, type Job } from 'bullmq'
import Redis from 'ioredis'
import type {
  EventJobData,
  NotificationJobData,
  WebhookJobData,
  OutboxJobData,
} from './queues'
import { QUEUE_NAMES, EVENT_NAMES } from './types'

// ============================================
// REDIS CONNECTION FACTORY
// ============================================

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6380'

function createWorkerRedis(): Redis {
  const conn = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    retryStrategy: (times) => {
      if (times > 10) return null
      return Math.min(times * 1000, 10000)
    },
  })
  conn.on('error', () => {})
  return conn
}

// ============================================
// EVENT HANDLER REGISTRY
// ============================================

type EventHandlerFn = (job: Job<EventJobData>) => Promise<void>

const eventHandlers = new Map<string, EventHandlerFn[]>()

/**
 * Register a handler for a specific event name.
 * Multiple handlers can be registered per event.
 */
export function registerEventHandler(
  eventName: string,
  handler: EventHandlerFn
): void {
  if (!eventHandlers.has(eventName)) {
    eventHandlers.set(eventName, [])
  }
  eventHandlers.get(eventName)!.push(handler)
}

// ============================================
// DEFAULT EVENT HANDLERS
// ============================================

/**
 * Register all default event handlers.
 * These handle the most common cross-module events.
 */
function registerDefaultHandlers(): void {
  // --- BILLING EVENTS ---

  registerEventHandler(EVENT_NAMES.INVOICE_PAID, async (job) => {
    const { payload } = job.data
    console.log(`[Worker] Invoice paid: ${payload.invoiceId} for customer ${payload.pelangganId}`)

    // Activate customer in main DB when invoice is paid
    try {
      const { prisma } = await import('@/lib/prisma')
      await prisma.pelanggan.update({
        where: { id: payload.pelangganId },
        data: { status: 'AKTIF' },
      })
      console.log(`[Worker] Customer ${payload.pelangganId} activated after payment`)
    } catch (error) {
      console.error(`[Worker] Failed to activate customer ${payload.pelangganId}:`, error)
      throw error // Let BullMQ retry
    }
  })

  // --- NOTIFICATION EVENTS ---

  registerEventHandler(EVENT_NAMES.NOTIFICATION_CREATED, async (job) => {
    const { payload } = job.data

    // Emit WebSocket notification
    try {
      const { socketEmitter } = await import('@/lib/websocket/emitter')

      if (payload.userId) {
        socketEmitter.notifyUser(payload.userId, {
          id: payload.notificationId,
          type: payload.type,
          priority: payload.priority,
          title: payload.title,
          message: payload.message,
          link: payload.link,
          createdAt: payload.timestamp || new Date().toISOString(),
        })
      }

      if (payload.departmentId) {
        socketEmitter.notifyDepartment(payload.departmentId, {
          id: payload.notificationId,
          type: payload.type,
          priority: payload.priority,
          title: payload.title,
          message: payload.message,
          link: payload.link,
          createdAt: payload.timestamp || new Date().toISOString(),
        })
      }

      if (payload.priority === 'HIGH' || payload.priority === 'URGENT') {
        socketEmitter.notifyAdmins({
          id: payload.notificationId,
          type: payload.type,
          priority: payload.priority,
          title: payload.title,
          message: payload.message,
          link: payload.link,
          createdAt: payload.timestamp || new Date().toISOString(),
        })
      }
    } catch (error) {
      console.error('[Worker] WebSocket notification error:', error)
    }
  })

  // --- WORK ORDER EVENTS ---

  registerEventHandler(EVENT_NAMES.WORK_ORDER_CREATED, async (job) => {
    const { payload } = job.data

    try {
      const { socketEmitter } = await import('@/lib/websocket/emitter')
      const { notifyNewWorkOrder } = await import('@/modules/notification/services/NotificationService')

      // Emit real-time update via Socket.IO
      socketEmitter.newWorkOrder(
        {
          id: payload.workOrderId,
          workOrderNumber: payload.workOrderNumber,
          title: payload.title,
          type: payload.type,
          status: 'OPEN',
          priority: payload.priority,
          assignedToId: payload.assignedToId,
          departmentId: payload.departmentId,
        },
        payload.departmentId,
        payload.siteId
      )

      // Send notifications to eligible users
      await notifyNewWorkOrder({
        workOrderId: payload.workOrderId,
        workOrderNumber: payload.workOrderNumber,
        title: payload.title,
        type: payload.type,
        priority: payload.priority,
        departmentId: payload.departmentId,
        siteId: payload.siteId,
        assignedToId: payload.assignedToId,
        triggeredByUserId: payload.triggeredBy,
      })
    } catch (error) {
      console.error('[Worker] Work order created handler error:', error)
      throw error
    }
  })

  registerEventHandler(EVENT_NAMES.WORK_ORDER_ASSIGNED, async (job) => {
    const { payload } = job.data

    try {
      const { socketEmitter } = await import('@/lib/websocket/emitter')
      const { notifyWorkOrderAssigned } = await import('@/modules/notification/services/NotificationService')

      socketEmitter.workOrderAssigned(
        {
          id: payload.workOrderId,
          workOrderNumber: payload.workOrderNumber,
          title: payload.title,
          type: 'WORK_ORDER',
          status: 'ASSIGNED',
          priority: 'NORMAL',
          assignedToId: payload.assignedToId,
        },
        payload.assignedToId
      )

      await notifyWorkOrderAssigned({
        workOrderId: payload.workOrderId,
        workOrderNumber: payload.workOrderNumber,
        title: payload.title,
        type: 'WORK_ORDER',
        priority: 'NORMAL',
        assignedToId: payload.assignedToId,
        assigneeName: payload.assignedToName,
        departmentId: payload.departmentId,
        siteId: payload.siteId,
        triggeredByUserId: payload.triggeredBy,
      })
    } catch (error) {
      console.error('[Worker] Work order assigned handler error:', error)
      throw error
    }
  })

  // --- INVENTORY EVENTS ---

  registerEventHandler(EVENT_NAMES.INVENTORY_STOCK_IN, async (job) => {
    const { payload } = job.data
    try {
      const { socketEmitter } = await import('@/lib/websocket/emitter')
      socketEmitter.inventoryUpdate({
        type: 'masuk',
        userId: payload.userId,
        barangId: payload.barangId,
        jumlah: payload.jumlah,
        totalStok: payload.totalStok,
        gudangId: payload.gudangId,
        siteId: payload.siteId,
      })
    } catch (error) {
      console.error('[Worker] Inventory stock-in handler error:', error)
    }
  })

  registerEventHandler(EVENT_NAMES.INVENTORY_STOCK_OUT, async (job) => {
    const { payload } = job.data
    try {
      const { socketEmitter } = await import('@/lib/websocket/emitter')
      socketEmitter.inventoryUpdate({
        type: 'keluar',
        userId: payload.userId,
        barangId: payload.barangId,
        jumlah: payload.jumlah,
        totalStok: payload.totalStok,
        gudangId: payload.gudangId,
        siteId: payload.siteId,
      })
    } catch (error) {
      console.error('[Worker] Inventory stock-out handler error:', error)
    }
  })

  // --- TICKET EVENTS ---

  registerEventHandler(EVENT_NAMES.TICKET_CREATED, async (job) => {
    const { payload } = job.data
    try {
      const { socketEmitter } = await import('@/lib/websocket/emitter')
      socketEmitter.newTicket(
        {
          id: payload.ticketId,
          ticketNumber: payload.ticketNumber,
          subject: payload.subject,
          status: 'OPEN',
          priority: payload.priority,
          pelangganNama: payload.pelangganNama,
        },
        payload.siteId
      )
    } catch (error) {
      console.error('[Worker] Ticket created handler error:', error)
    }
  })

  registerEventHandler(EVENT_NAMES.TICKET_REPLY, async (job) => {
    const { payload } = job.data
    try {
      const { socketEmitter } = await import('@/lib/websocket/emitter')
      socketEmitter.ticketReply(
        {
          id: payload.ticketId,
          ticketNumber: payload.ticketNumber,
          subject: '',
          status: '',
          priority: '',
        },
        payload.siteId,
        payload.targetUserId
      )
    } catch (error) {
      console.error('[Worker] Ticket reply handler error:', error)
    }
  })

  registerEventHandler(EVENT_NAMES.TICKET_STATUS_CHANGED, async (job) => {
    const { payload } = job.data
    try {
      const { socketEmitter } = await import('@/lib/websocket/emitter')
      socketEmitter.updateTicket(
        {
          id: payload.ticketId,
          ticketNumber: payload.ticketNumber,
          subject: payload.subject,
          status: 'UPDATED',
          priority: payload.priority,
        },
        payload.siteId
      )
    } catch (error) {
      console.error('[Worker] Ticket status changed handler error:', error)
    }
  })

  // --- ATTENDANCE EVENTS ---

  registerEventHandler(EVENT_NAMES.ATTENDANCE_CHECKIN, async (job) => {
    const { payload } = job.data
    try {
      const { socketEmitter } = await import('@/lib/websocket/emitter')
      // Notify admin room about check-in
      socketEmitter.broadcast('attendance:checkin', {
        userId: payload.userId,
        attendanceId: payload.attendanceId,
        timestamp: payload.timestamp,
      })
    } catch (error) {
      console.error('[Worker] Attendance checkin handler error:', error)
    }
  })

  registerEventHandler(EVENT_NAMES.ATTENDANCE_ABSENT, async (job) => {
    const { payload } = job.data
    try {
      // Create notification for absent users
      const { addNotificationJob } = await import('./queues')
      await addNotificationJob({
        type: 'websocket',
        title: 'Ketidakhadiran',
        body: `${payload.userName || 'Karyawan'} tidak hadir`,
        room: 'admin:notifications',
        event: 'attendance:absent',
        data: {
          userId: payload.userId,
          attendanceId: payload.attendanceId,
          timestamp: payload.timestamp,
        },
      })
    } catch (error) {
      console.error('[Worker] Attendance absent handler error:', error)
    }
  })

  // --- NETWORK EVENTS ---

  registerEventHandler(EVENT_NAMES.NETWORK_DEVICE_OFFLINE, async (job) => {
    const { payload } = job.data
    console.log(`[Worker] Network device offline: ${payload.deviceName} (${payload.deviceType})`)
    // Could trigger alerts, auto-ticket creation, etc.
  })
}

// ============================================
// PROCESSING FUNCTIONS
// ============================================

async function processEventJob(job: Job<EventJobData>): Promise<void> {
  const { eventName } = job.data
  const handlers = eventHandlers.get(eventName)

  if (!handlers || handlers.length === 0) {
    console.log(`[Worker] No handlers registered for event: ${eventName}`)
    return
  }

  console.log(`[Worker] Processing event: ${eventName} (handlers: ${handlers.length})`)

  for (const handler of handlers) {
    await handler(job)
  }
}

async function processNotificationJob(job: Job<NotificationJobData>): Promise<void> {
  const data = job.data
  console.log(`[Worker] Processing notification: ${data.type} for ${data.userId || data.departmentId || 'broadcast'}`)

  switch (data.type) {
    case 'expo_push': {
      if (!data.pushToken) break
      try {
        const { sendPushNotification } = await import('@/modules/notification/services/ExpoPushService')
        await sendPushNotification(data.pushToken, data.title, data.body, data.data)
      } catch (error) {
        console.error('[Worker] Expo push failed:', error)
        throw error // Retry
      }
      break
    }

    case 'web_push': {
      if (!data.subscription) break
      try {
        const { sendPushNotification } = await import('@/modules/notification/services/PushNotificationService')
        await sendPushNotification(
          {
            endpoint: data.subscription.endpoint,
            keys: { p256dh: data.subscription.p256dh, auth: data.subscription.auth },
          },
          { title: data.title, body: data.body, data: data.data }
        )
      } catch (error) {
        console.error('[Worker] Web push failed:', error)
        throw error // Retry
      }
      break
    }

    case 'websocket': {
      if (!data.room || !data.event) break
      try {
        const { socketEmitter } = await import('@/lib/websocket/emitter')
        socketEmitter.broadcast(data.event, data.data)
      } catch (error) {
        console.error('[Worker] WebSocket emit failed:', error)
      }
      break
    }
  }
}

async function processWebhookJob(job: Job<WebhookJobData>): Promise<void> {
  const { provider, payload, signature } = job.data
  console.log(`[Worker] Processing webhook from: ${provider}`)

  try {
    const { PaymentGatewayManager } = await import('@/modules/finance/services/payment-gateway/gateway-manager')
    const { prisma } = await import('@/lib/prisma')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gatewayManager = new PaymentGatewayManager(prisma as any)
    await gatewayManager.processWebhook(provider, payload, signature ?? '')
  } catch (error) {
    console.error(`[Worker] Webhook processing failed for ${provider}:`, error)
    throw error // Retry
  }
}

async function processOutboxJob(job: Job<OutboxJobData>): Promise<void> {
  const { outboxEventId, eventName, payload } = job.data
  console.log(`[Worker] Processing outbox event: ${eventName} (${outboxEventId})`)

  try {
    // Process the event through registered handlers
    const handlers = eventHandlers.get(eventName)
    if (handlers && handlers.length > 0) {
      const mockJob = { data: { eventName, payload, category: 'outbox', timestamp: new Date().toISOString() } } as Job<EventJobData>
      for (const handler of handlers) {
        await handler(mockJob)
      }
    }

    // Mark as processed in outbox
    const { markEventProcessed } = await import('./outbox')
    await markEventProcessed(outboxEventId)
  } catch (error) {
    const { markEventFailed } = await import('./outbox')
    await markEventFailed(outboxEventId, error instanceof Error ? error.message : String(error))
    throw error // Let BullMQ retry
  }
}

// ============================================
// WORKER INSTANCES
// ============================================

let workers: Worker[] = []
let _handlersRegistered = false

/**
 * Start all BullMQ workers.
 * Call this once during application startup.
 */
export function startWorkers(): void {
  if (!_handlersRegistered) {
    registerDefaultHandlers()
    _handlersRegistered = true
  }

  const connection = createWorkerRedis()

  // Event Worker
  const eventWorker = new Worker<EventJobData>(
    QUEUE_NAMES.EVENTS,
    processEventJob,
    {
      connection: connection.duplicate(),
      concurrency: 10,
      limiter: { max: 100, duration: 1000 }, // 100 jobs/sec
    }
  )

  // Notification Worker
  const notificationWorker = new Worker<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATIONS,
    processNotificationJob,
    {
      connection: connection.duplicate(),
      concurrency: 20,
      limiter: { max: 50, duration: 1000 }, // 50 notifications/sec
    }
  )

  // Webhook Worker
  const webhookWorker = new Worker<WebhookJobData>(
    QUEUE_NAMES.WEBHOOKS,
    processWebhookJob,
    {
      connection: connection.duplicate(),
      concurrency: 5,
    }
  )

  // Outbox Worker
  const outboxWorker = new Worker<OutboxJobData>(
    QUEUE_NAMES.OUTBOX,
    processOutboxJob,
    {
      connection: connection.duplicate(),
      concurrency: 5,
    }
  )

  workers = [eventWorker, notificationWorker, webhookWorker, outboxWorker]

  // Event listeners for monitoring
  for (const worker of workers) {
    worker.on('completed', (job) => {
      console.log(`[BullMQ] ${worker.name}: Job ${job.id} completed`)
    })

    worker.on('failed', (job, err) => {
      console.error(`[BullMQ] ${worker.name}: Job ${job?.id} failed:`, err.message)
    })

    worker.on('error', (err) => {
      console.error(`[BullMQ] ${worker.name}: Worker error:`, err.message)
    })
  }

  console.log('[BullMQ] All workers started')
}

/**
 * Stop all BullMQ workers gracefully.
 */
export async function stopWorkers(): Promise<void> {
  const stopPromises = workers.map((worker) => worker.close())
  await Promise.allSettled(stopPromises)
  workers = []
  console.log('[BullMQ] All workers stopped')
}

/**
 * Get worker health status
 */
export function getWorkerStatus(): Array<{ name: string; isRunning: boolean }> {
  return workers.map((w) => ({
    name: w.name,
    isRunning: !w.closing,
  }))
}
