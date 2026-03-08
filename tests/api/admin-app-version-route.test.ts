import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockHasPermission = vi.fn()
const mockUploadVersion = vi.fn()
const mockLogActivitySafe = vi.fn()
const mockDeleteFromR2 = vi.fn()
const mockWriteFile = vi.fn()
const mockUnlink = vi.fn()

vi.mock('@/lib/rbac', () => ({
  hasPermission: (...args: unknown[]) => mockHasPermission(...args)
}))

vi.mock('@/modules/app-version', () => ({
  getAppVersionService: () => ({
    uploadVersion: (...args: unknown[]) => mockUploadVersion(...args)
  })
}))

vi.mock('@/lib/logger', () => ({
  logActivitySafe: (...args: unknown[]) => mockLogActivitySafe(...args)
}))

vi.mock('@/lib/utils/r2-client', () => ({
  deleteFromR2: (...args: unknown[]) => mockDeleteFromR2(...args)
}))

vi.mock('fs/promises', () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args)
}))

vi.mock('@/lib/api', () => ({
  createHandler: (_options: unknown, handler: (req: Request, ctx: { session: { user: { id: string } } }) => unknown) => {
    return (req: Request) => handler(req, { session: { user: { id: 'admin-1' } } })
  },
  apiSuccess: (data: unknown, options?: { status?: number; message?: string }) => ({
    success: true,
    data,
    status: options?.status,
    message: options?.message
  }),
  apiError: (error: string, code: string, options?: { status?: number }) => ({
    success: false,
    error,
    code,
    status: options?.status
  }),
  apiPaginated: vi.fn(),
  ApiErrors: {
    forbidden: (message: string) => ({ success: false, error: message, status: 403 })
  },
  ErrorCodes: {
    VALIDATION_ERROR: 'VALIDATION_ERROR'
  }
}))

import { POST } from '@/app/api/admin/app-version/route'

describe('POST /api/admin/app-version', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasPermission.mockResolvedValue(true)
  })

  it('rejects malformed numeric fields before calling upload service', async () => {
    const formData = new FormData()
    formData.append('version', '1.0.80')
    formData.append('buildNumber', '80abc')
    formData.append('versionCode', '80')

    const result = await POST(
      new NextRequest('http://localhost/api/admin/app-version', {
        method: 'POST',
        body: formData
      }),
      { params: Promise.resolve({}) }
    )

    expect(result).toEqual({
      success: false,
      error: 'buildNumber harus berupa angka bulat positif',
      code: 'VALIDATION_ERROR',
      status: 400
    })
    expect(mockUploadVersion).not.toHaveBeenCalled()
  })

  it('cleans up temp APK files when service upload fails', async () => {
    const formData = new FormData()
    formData.append('apk', new File([Buffer.from('apk')], 'release.apk', { type: 'application/vnd.android.package-archive' }))

    mockUploadVersion.mockRejectedValueOnce(new Error('upload failed'))

    await expect(POST(
      new NextRequest('http://localhost/api/admin/app-version', {
        method: 'POST',
        body: formData
      }),
      { params: Promise.resolve({}) }
    )).rejects.toThrow('upload failed')

    expect(mockWriteFile).toHaveBeenCalledTimes(1)
    expect(mockUnlink).toHaveBeenCalledTimes(1)
    expect(mockDeleteFromR2).not.toHaveBeenCalled()
  })

  it('deletes orphaned direct-upload objects when metadata save fails', async () => {
    const formData = new FormData()
    formData.append('uploadedKey', 'uploads/app-version/direct.apk')
    formData.append('uploadedFilename', 'direct.apk')
    formData.append('uploadedSize', '4096')

    mockUploadVersion.mockRejectedValueOnce(new Error('save failed'))

    await expect(POST(
      new NextRequest('http://localhost/api/admin/app-version', {
        method: 'POST',
        body: formData
      }),
      { params: Promise.resolve({}) }
    )).rejects.toThrow('save failed')

    expect(mockDeleteFromR2).toHaveBeenCalledWith('uploads/app-version/direct.apk')
  })
})
