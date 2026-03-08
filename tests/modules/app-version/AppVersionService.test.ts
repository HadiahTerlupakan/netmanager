import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppVersionService } from '@/modules/app-version/services/AppVersionService'
import type { AppVersionWithUser } from '@/modules/app-version/repositories/AppVersionRepository'

const { mockUnlink, mockDeleteFromR2 } = vi.hoisted(() => ({
  mockUnlink: vi.fn(),
  mockDeleteFromR2: vi.fn()
}))

vi.mock('fs/promises', () => ({
  default: {
    unlink: mockUnlink
  }
}))

vi.mock('@/lib/utils/r2-client', () => ({
  isR2Enabled: vi.fn(),
  uploadToR2: vi.fn(),
  generateR2Key: vi.fn(),
  deleteFromR2: mockDeleteFromR2
}))

type MockRepository = {
  getLatestVersion: ReturnType<typeof vi.fn>
  findById: ReturnType<typeof vi.fn>
  findByVersion: ReturnType<typeof vi.fn>
  findByVersionCode: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

const baseVersion: AppVersionWithUser = {
  id: 'ver-1',
  version: '1.0.54',
  buildNumber: 54,
  versionCode: 54,
  platform: 'android',
  apkUrl: 'https://example.com/app.apk',
  apkSize: 1024n,
  releaseNotes: 'Fixes',
  isForceUpdate: false,
  minVersion: '1.0.50',
  isActive: true,
  publishedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: null,
  user: null
}

describe('AppVersionService', () => {
  let service: AppVersionService
  let repository: MockRepository

  beforeEach(() => {
    service = new AppVersionService()
    repository = {
      getLatestVersion: vi.fn(),
      findById: vi.fn(),
      findByVersion: vi.fn(),
      findByVersionCode: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    }
    ;(service as unknown as { repository: typeof repository }).repository = repository
    mockUnlink.mockReset()
    mockDeleteFromR2.mockReset()
  })

  describe('evaluateVersionAccess', () => {
    it('returns supported when no active app version exists', async () => {
      repository.getLatestVersion.mockResolvedValueOnce(null)

      const result = await service.evaluateVersionAccess(10)

      expect(result.isSupported).toBe(true)
      expect(result.updateAvailable).toBe(false)
      expect(result.isForceUpdate).toBe(false)
      expect(result.latestVersion).toBeNull()
    })

    it('forces update when client is below configured minimum version', async () => {
      repository.getLatestVersion.mockResolvedValueOnce({
        ...baseVersion
      })

      const result = await service.evaluateVersionAccess(49)

      expect(result.isSupported).toBe(false)
      expect(result.updateAvailable).toBe(true)
      expect(result.isForceUpdate).toBe(true)
      expect(result.minimumVersion).toBe('1.0.50')
      expect(result.latestVersion?.versionCode).toBe(54)
    })

    it('allows older clients when update is optional', async () => {
      repository.getLatestVersion.mockResolvedValueOnce({
        ...baseVersion,
        id: 'ver-2',
        apkUrl: '/uploads/app.apk',
        apkSize: 2048,
        minVersion: null
      })

      const result = await service.evaluateVersionAccess(53)

      expect(result.isSupported).toBe(true)
      expect(result.updateAvailable).toBe(true)
      expect(result.isForceUpdate).toBe(false)
      expect(result.latestVersion?.downloadUrl).toBe('/api/mobile/app-version/download/ver-2')
    })

    it('forces update when latest version is marked mandatory', async () => {
      repository.getLatestVersion.mockResolvedValueOnce({
        ...baseVersion,
        id: 'ver-3',
        releaseNotes: null,
        apkSize: null,
        isForceUpdate: true,
        minVersion: null
      })

      const result = await service.evaluateVersionAccess(53)

      expect(result.isSupported).toBe(false)
      expect(result.isForceUpdate).toBe(true)
    })
  })

  describe('updateVersion', () => {
    it('preserves minVersion when edit payload omits it', async () => {
      repository.findById.mockResolvedValueOnce(baseVersion)
      repository.update.mockImplementationOnce(async (_id, data) => ({
        ...baseVersion,
        ...data
      }))

      await service.updateVersion(baseVersion.id, {
        releaseNotes: 'Patched notes',
        isForceUpdate: true,
        isActive: true
      })

      expect(repository.update).toHaveBeenCalledWith(baseVersion.id, {
        releaseNotes: 'Patched notes',
        isForceUpdate: true,
        isActive: true,
        minVersion: baseVersion.minVersion
      })
    })

    it('allows explicitly clearing minVersion with null', async () => {
      repository.findById.mockResolvedValueOnce(baseVersion)
      repository.update.mockImplementationOnce(async (_id, data) => ({
        ...baseVersion,
        ...data
      }))

      await service.updateVersion(baseVersion.id, {
        minVersion: null
      })

      expect(repository.update).toHaveBeenCalledWith(baseVersion.id, {
        minVersion: null
      })
    })
  })

  describe('deleteVersion', () => {
    it('deletes local APK files from public/uploads/apk', async () => {
      repository.findById.mockResolvedValueOnce({
        ...baseVersion,
        apkUrl: '/uploads/apk/netmanager_v1.0.54.apk'
      })

      await service.deleteVersion(baseVersion.id)

      expect(mockUnlink).toHaveBeenCalledTimes(1)
      expect(mockUnlink.mock.calls[0]?.[0]).toContain('public')
      expect(mockUnlink.mock.calls[0]?.[0]).toContain('uploads/apk/netmanager_v1.0.54.apk')
      expect(mockDeleteFromR2).not.toHaveBeenCalled()
      expect(repository.delete).toHaveBeenCalledWith(baseVersion.id)
    })

    it('deletes R2 APK objects using extracted key', async () => {
      mockDeleteFromR2.mockResolvedValueOnce(true)
      repository.findById.mockResolvedValueOnce({
        ...baseVersion,
        apkUrl: 'https://cdn.example.com/uploads/apk/netmanager_v1.0.54.apk'
      })

      await service.deleteVersion(baseVersion.id)

      expect(mockDeleteFromR2).toHaveBeenCalledWith('uploads/apk/netmanager_v1.0.54.apk')
      expect(mockUnlink).not.toHaveBeenCalled()
      expect(repository.delete).toHaveBeenCalledWith(baseVersion.id)
    })
  })
})
