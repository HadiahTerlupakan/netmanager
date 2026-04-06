import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockHasPermission = vi.fn()
const mockUploadVersion = vi.fn()
const mockLogActivitySafe = vi.fn()

vi.mock('@/lib/rbac', () => ({
  hasPermission: (...args: unknown[]) => mockHasPermission(...args)
}))

vi.mock('@/modules/app-version', async () => {
  const actual = await vi.importActual<typeof import('@/modules/app-version')>('@/modules/app-version')

  return {
    ...actual,
    getAppVersionService: () => ({
      uploadVersion: (...args: unknown[]) => mockUploadVersion(...args)
    })
  }
})

vi.mock('@/lib/logger', () => ({
  logActivitySafe: (...args: unknown[]) => mockLogActivitySafe(...args)
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

  it('passes APK uploads to the service and propagates upload errors', async () => {
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

    expect(mockUploadVersion).toHaveBeenCalledTimes(1)
    const [servicePayload] = mockUploadVersion.mock.calls[0]
    expect(servicePayload).toMatchObject({
      platform: 'android',
      apkFilename: 'release.apk'
    })
    expect(servicePayload.apkFile).toBeInstanceOf(File)
  })

  it('passes direct upload metadata through to the service when validation fails', async () => {
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

    expect(mockUploadVersion).toHaveBeenCalledTimes(1)
    const [servicePayload] = mockUploadVersion.mock.calls[0]
    expect(servicePayload).toMatchObject({
      uploadedKey: 'uploads/app-version/direct.apk',
      uploadedFilename: 'direct.apk',
      uploadedSize: 4096
    })
  })
})
