import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUseSession = vi.fn()
const mockUseSocket = vi.fn()
const mockUseSocketEvent = vi.fn()
const mockUseState = vi.fn()
const mockUseCallback = vi.fn((fn, _deps?: unknown[]) => fn)
const mockUseEffect = vi.fn()

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useState: (...args: unknown[]) => mockUseState(...(args as [unknown])),
    useCallback: (...args: unknown[]) => mockUseCallback(...(args as [(...input: unknown[]) => unknown, unknown[]?])),
    useEffect: (...args: unknown[]) => mockUseEffect(...(args as [() => void | (() => void), unknown[]?])),
  }
})

vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}))

vi.mock('@/lib/websocket/SocketContext', () => ({
  useSocket: () => mockUseSocket(),
  useSocketEvent: (...args: unknown[]) => mockUseSocketEvent(...args),
}))

import { useRadiusDashboardData } from '@/app/admin/network/radius/hooks/useRadiusDashboardData'

describe('useRadiusDashboardData', () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({
      data: { user: { tenantId: 'tenant-1' } },
    })

    mockUseSocket.mockReturnValue({
      socket: null,
      isConnected: false,
    })

    mockUseSocketEvent.mockReset()
    mockUseEffect.mockReset()
    mockUseCallback.mockClear()
    mockUseState.mockReset()
  })

  it('clears history row loading state when modal is closed', () => {
    const setResettingUsername = vi.fn()
    const setViewingHistoryUsername = vi.fn()
    const setHistoryModalOpen = vi.fn()
    const setHistoryLoading = vi.fn()
    const setHistoryError = vi.fn()
    const setHistoryData = vi.fn()
    const setHistoryStartDate = vi.fn()
    const setHistoryEndDate = vi.fn()
    const setActionError = vi.fn()
    const setActionSuccess = vi.fn()
    const setStats = vi.fn()
    const setSessions = vi.fn()
    const setLoading = vi.fn()
    const setRefreshing = vi.fn()

    mockUseState
      .mockReturnValueOnce([null, setResettingUsername])
      .mockReturnValueOnce(['test-user', setViewingHistoryUsername])
      .mockReturnValueOnce([true, setHistoryModalOpen])
      .mockReturnValueOnce([false, setHistoryLoading])
      .mockReturnValueOnce([null, setHistoryError])
      .mockReturnValueOnce([null, setHistoryData])
      .mockReturnValueOnce(['', setHistoryStartDate])
      .mockReturnValueOnce(['', setHistoryEndDate])
      .mockReturnValueOnce([null, setActionError])
      .mockReturnValueOnce([null, setActionSuccess])
      .mockReturnValueOnce([null, setStats])
      .mockReturnValueOnce([[], setSessions])
      .mockReturnValueOnce([true, setLoading])
      .mockReturnValueOnce([false, setRefreshing])

    const hook = useRadiusDashboardData()

    hook.closeHistoryModal()

    expect(setHistoryModalOpen).toHaveBeenCalledWith(false)
    expect(setHistoryError).toHaveBeenCalledWith(null)
    expect(setViewingHistoryUsername).toHaveBeenCalledWith(null)
  })
})
