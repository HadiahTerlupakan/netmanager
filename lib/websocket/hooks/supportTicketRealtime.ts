import { SOCKET_EVENTS } from '../types'

export const SUPPORT_TICKET_REFETCH_EVENTS = [
  SOCKET_EVENTS.TICKET_NEW,
  SOCKET_EVENTS.TICKET_REPLY,
  SOCKET_EVENTS.TICKET_MESSAGE,
] as const

export function shouldRefetchSupportTickets(eventName: string): boolean {
  return SUPPORT_TICKET_REFETCH_EVENTS.includes(eventName as (typeof SUPPORT_TICKET_REFETCH_EVENTS)[number])
}
