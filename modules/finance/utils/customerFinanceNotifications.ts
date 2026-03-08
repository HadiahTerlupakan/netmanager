import { createNotification } from '@/modules/notification/services/NotificationService'

interface CustomerFinanceNotificationInput {
  userId: string | null | undefined
  title: string
  message: string
  link: string
  sourceType: string
  sourceId: string
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
}

export async function notifyCustomerFinanceNotification(input: CustomerFinanceNotificationInput): Promise<boolean> {
  if (!input.userId) {
    return false
  }

  await createNotification({
    type: 'SYSTEM',
    userId: input.userId,
    title: input.title,
    message: input.message,
    link: input.link,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    priority: input.priority,
  })

  return true
}
