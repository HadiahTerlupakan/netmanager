import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma-radius', () => ({
  prismaRadius: {},
}))

import { CustomerUsageService } from '@/modules/pelanggan/services/CustomerUsageService'

describe('CustomerUsageService.getTechnicalInfo', () => {
  let service: CustomerUsageService
  const repository = {
    getStaticIpReply: vi.fn(),
    getLatestSessionForTechnicalInfo: vi.fn(),
    getRouterNameByNasIp: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    service = new CustomerUsageService()
    ;(service as unknown as { repository: typeof repository }).repository = repository
  })

  it('prefers radreply static IP and package router when both are available', async () => {
    repository.getStaticIpReply.mockResolvedValue({ value: '10.10.10.2' })
    repository.getLatestSessionForTechnicalInfo.mockResolvedValue({
      framedipaddress: '10.10.10.3',
      nasipaddress: '172.16.0.1',
    })
    repository.getRouterNameByNasIp.mockResolvedValue({ name: 'NAS Router' })

    const technicalInfo = await (service as unknown as {
      getTechnicalInfo: (input: {
        username: string
        tenantId?: string | null
        packageRouterName?: string | null
        odpName?: string | null
        odpLocation?: string | null
      }) => Promise<{
        staticIpAddress: string | null
        staticIpSource: string | null
        serverRouterName: string | null
        serverRouterSource: string | null
        odpPortValue: string | null
        odpPortSource: string | null
      }>
    }).getTechnicalInfo({
      username: 'customer-1',
      tenantId: 'tenant-1',
      packageRouterName: 'Profile Router',
      odpName: 'ODP-1',
      odpLocation: 'Port 1',
    })

    expect(technicalInfo).toEqual({
      staticIpAddress: '10.10.10.2',
      staticIpSource: 'radreply · Framed-IP-Address',
      serverRouterName: 'Profile Router',
      serverRouterSource: 'Profile PPP · MikroTik Router',
      odpPortValue: 'ODP-1 · Port 1',
      odpPortSource: 'Relasi pelanggan · ODP',
    })
    expect(repository.getRouterNameByNasIp).toHaveBeenCalledWith('172.16.0.1', 'tenant-1')
  })

  it('falls back to latest RADIUS session and NAS router when profile router is missing', async () => {
    repository.getStaticIpReply.mockResolvedValue(null)
    repository.getLatestSessionForTechnicalInfo.mockResolvedValue({
      framedipaddress: '10.20.30.40',
      nasipaddress: '172.16.0.2',
    })
    repository.getRouterNameByNasIp.mockResolvedValue({ name: 'Router dari NAS' })

    const technicalInfo = await (service as unknown as {
      getTechnicalInfo: (input: {
        username: string
        tenantId?: string | null
        packageRouterName?: string | null
        odpName?: string | null
        odpLocation?: string | null
      }) => Promise<{
        staticIpAddress: string | null
        staticIpSource: string | null
        serverRouterName: string | null
        serverRouterSource: string | null
        odpPortValue: string | null
        odpPortSource: string | null
      }>
    }).getTechnicalInfo({
      username: 'customer-2',
      tenantId: 'tenant-2',
      packageRouterName: null,
      odpName: 'ODP-2',
      odpLocation: null,
    })

    expect(technicalInfo).toEqual({
      staticIpAddress: '10.20.30.40',
      staticIpSource: 'radacct · sesi terakhir',
      serverRouterName: 'Router dari NAS',
      serverRouterSource: 'NAS IP · MikroTik Router',
      odpPortValue: 'ODP-2',
      odpPortSource: 'Relasi pelanggan · ODP',
    })
  })
})
