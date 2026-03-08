import { describe, expect, it } from 'vitest'
import { SOCKET_EVENTS } from '@/lib/websocket/types'
import { shouldRefetchSupportTickets } from '@/lib/websocket/hooks/supportTicketRealtime'

describe('shouldRefetchSupportTickets', () => {
  it('returns true for real reply-bearing support events', () => {
    expect(shouldRefetchSupportTickets(SOCKET_EVENTS.TICKET_NEW)).toBe(true)
    expect(shouldRefetchSupportTickets(SOCKET_EVENTS.TICKET_REPLY)).toBe(true)
    expect(shouldRefetchSupportTickets(SOCKET_EVENTS.TICKET_MESSAGE)).toBe(true)
  })

  it('returns false for unrelated support events', () => {
    expect(shouldRefetchSupportTickets(SOCKET_EVENTS.TICKET_UPDATE)).toBe(false)
    expect(shouldRefetchSupportTickets(SOCKET_EVENTS.TICKET_COUNT)).toBe(false)
    expect(shouldRefetchSupportTickets(SOCKET_EVENTS.NOTIFICATION_NEW)).toBe(false)
  })
})
