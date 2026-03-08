'use client'

import { useState, useEffect, useCallback } from 'react'
import { HiOutlinePencil, HiOutlineTrash, HiOutlineCloudArrowUp, HiOutlineDevicePhoneMobile, HiOutlineExclamationTriangle, HiOutlineQuestionMarkCircle } from 'react-icons/hi2'
import { usePermission } from '@/hooks/use-permission'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { Modal, ModalFooter } from '@/components/ui/Modal'

interface AppVersion {
    id: string
    version: string
    buildNumber: number
    versionCode: number
    platform: string
    apkUrl: string | null
    apkSize: number | null
    releaseNotes: string | null
    isForceUpdate: boolean
    minVersion: string | null
    isActive: boolean
    publishedAt: string | null
    createdAt: string
    user: { id: string; name: string | null; email: string } | null
}

interface Pagination {
    page: number
    limit: number
    total: number
    totalPages: number
}

export function AppVersionClient() {
    // Permission checks
    const { hasPermission } = usePermission()
    const canCreate = hasPermission('app_version:create')
    const canUpdate = hasPermission('app_version:update')
    const canDelete = hasPermission('app_version:delete')

    // State
    const [versions, setVersions] = useState<AppVersion[]>([])
    const [loading, setLoading] = useState(true)
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 0 })
    const [showUploadModal, setShowUploadModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [selectedVersion, setSelectedVersion] = useState<AppVersion | null>(null)
    const [stats, setStats] = useState<{ updatedCount: number, outdatedCount: number, unknownCount: number, latestVersion: AppVersion | null } | null>(null)

    // Fetch stats
    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/app-version/stats')
            const data = await res.json()
            if (data && !data.error) {
                setStats(data)
            }
        } catch (error: unknown) {
            console.error('Failed to fetch stats:', error)
        }
    }, [])

    // Fetch versions
    const fetchVersions = useCallback(async () => {
        // Fetch stats as well
        fetchStats()

        setLoading(true)
        try {
            const res = await fetch(`/api/admin/app-version?page=${pagination.page}&limit=${pagination.limit}`)
            const data = await res.json()
            if (data.success) {
                setVersions(data.data || [])
                // Handle standard pagination meta from apiPaginated
                if (data.meta) {
                    setPagination(prev => ({
                        ...prev,
                        ...data.meta
                    }))
                }
                // Legacy fallback
                else if (data.pagination) {
                    setPagination(prev => ({
                        ...prev,
                        ...data.pagination
                    }))
                }
            }
        } catch (error: unknown) {
            console.error('Error fetching versions:', error)
        } finally {
            setLoading(false)
        }
    }, [fetchStats, pagination.page, pagination.limit])

    useEffect(() => {
        fetchVersions()
    }, [fetchVersions])

    // Format file size
    const formatFileSize = (bytes: number | null) => {
        if (!bytes) return '-'
        const mb = bytes / (1024 * 1024)
        return `${mb.toFixed(1)} MB`
    }

    // Format date
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-'
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    // Table columns
    const columns: Column<AppVersion>[] = [
        {
            key: 'version',
            header: 'Versi',
            priority: 'primary',
            render: (item) => (
                <div className="flex items-center gap-2">
                    <HiOutlineDevicePhoneMobile className="h-5 w-5 text-indigo-600" />
                    <div>
                        <div className="font-semibold">v{item.version}</div>
                        <div className="text-xs text-gray-500">Build {item.buildNumber} • Code {item.versionCode}</div>
                    </div>
                </div>
            )
        },
        {
            key: 'platform',
            header: 'Platform',
            priority: 'secondary',
            render: (item) => (
                <span className={`px-2 py-1 text-xs rounded-full ${item.platform === 'ios' ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'
                    }`}>
                    {item.platform.toUpperCase()}
                </span>
            )
        },
        {
            key: 'isForceUpdate',
            header: 'Tipe Update',
            priority: 'secondary',
            render: (item) => (
                <span className={`px-2 py-1 text-xs rounded-full ${item.isForceUpdate ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                    {item.isForceUpdate ? 'Wajib' : 'Opsional'}
                </span>
            )
        },
        {
            key: 'apkSize',
            header: 'Ukuran',
            priority: 'tertiary',
            render: (item) => formatFileSize(item.apkSize)
        },
        {
            key: 'isActive',
            header: 'Status',
            priority: 'secondary',
            render: (item) => (
                <span className={`px-2 py-1 text-xs rounded-full ${item.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                    {item.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
            )
        },
        {
            key: 'publishedAt',
            header: 'Dipublish',
            priority: 'tertiary',
            render: (item) => formatDate(item.publishedAt)
        }
    ]

    // Handle edit
    const handleEdit = (item: AppVersion) => {
        setSelectedVersion(item)
        setShowEditModal(true)
    }

    // Handle delete
    const handleDelete = async (id: string) => {
        if (!confirm('Apakah Anda yakin ingin menghapus versi ini secara permanen? File APK yang terkait juga akan dihapus.')) return

        try {
            const res = await fetch(`/api/admin/app-version/${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (data.success) {
                fetchVersions()
            } else {
                alert(data.error || 'Gagal menghapus versi')
            }
        } catch (error: unknown) {
            console.error('Error deleting version:', error)
            alert('Terjadi kesalahan')
        }
    }

    // Render actions
    const renderActions = (item: AppVersion) => (
        <div className="flex gap-1">
            {canUpdate && (
                <button
                    type="button"
                    onClick={() => handleEdit(item)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                >
                    <HiOutlinePencil className="h-4 w-4" />
                </button>
            )}
            {canDelete && item.isActive && (
                <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Hapus permanen"
                >
                    <HiOutlineTrash className="h-4 w-4" />
                </button>
            )}
        </div>
    )

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Versi Aplikasi</h1>
                    <p className="text-gray-600 dark:text-gray-400">Kelola versi aplikasi mobile dan force update</p>
                </div>
                {canCreate && (
                    <button
                        type="button"
                        onClick={() => setShowUploadModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <HiOutlineCloudArrowUp className="h-5 w-5" />
                        Upload Versi Baru
                    </button>
                )}
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg text-green-600 dark:text-green-400">
                                <HiOutlineDevicePhoneMobile className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Sudah Update</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.updatedCount}</p>
                                <p className="text-xs text-gray-400 mt-1">{stats.latestVersion ? `Versi ${stats.latestVersion.version} (${stats.latestVersion.versionCode})` : '-'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400">
                                <HiOutlineExclamationTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Belum Update</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.outdatedCount}</p>
                                <p className="text-xs text-gray-400 mt-1">Perlu update segera</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                                <HiOutlineQuestionMarkCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tidak Diketahui</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.unknownCount}</p>
                                <p className="text-xs text-gray-400 mt-1">Belum login sejak update</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* List Versions */}           {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <ResponsiveTable
                    data={versions}
                    columns={columns}
                    keyField="id"
                    loading={loading}
                    emptyMessage="Belum ada versi aplikasi yang diupload"
                    renderActions={renderActions}
                />
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        Menampilkan {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} dari {pagination.total}
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                            disabled={pagination.page <= 1}
                            className="px-3 py-1 border rounded-md disabled:opacity-50"
                        >
                            Prev
                        </button>
                        <button
                            type="button"
                            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                            disabled={pagination.page >= pagination.totalPages}
                            className="px-3 py-1 border rounded-md disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <UploadVersionModal
                    onClose={() => setShowUploadModal(false)}
                    onSuccess={() => {
                        setShowUploadModal(false)
                        fetchVersions()
                    }}
                />
            )}

            {/* Edit Modal */}
            {showEditModal && selectedVersion && (
                <EditVersionModal
                    version={selectedVersion}
                    onClose={() => {
                        setShowEditModal(false)
                        setSelectedVersion(null)
                    }}
                    onSuccess={() => {
                        setShowEditModal(false)
                        setSelectedVersion(null)
                        fetchVersions()
                    }}
                />
            )}
        </div>
    )
}

// Upload Modal Component
function UploadVersionModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [loading, setLoading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [status, setStatus] = useState<string>('')
    const [formData, setFormData] = useState({
        version: '',
        buildNumber: '',
        versionCode: '',
        platform: 'android',
        releaseNotes: '',
        isForceUpdate: false,
        minVersion: ''
    })
    const [apkFile, setApkFile] = useState<File | null>(null)
    const [isForceLocal, setIsForceLocal] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Jika tidak ada APK dan field kosong, tampilkan error
        if (!apkFile && (!formData.version || !formData.buildNumber || !formData.versionCode)) {
            alert('Upload APK untuk auto-detect versi, atau isi manual field Versi, Build, dan Code')
            return
        }

        setLoading(true)
        setUploadProgress(0)

        try {
            let apkKey = ''
            let apkFilename = ''
            let apkSize = 0

            // 1. Jika ada file, upload langsung ke storage (Direct Upload) - KECUALI forceLocal
            if (apkFile && !isForceLocal) {
                setStatus('Meminta URL upload...')

                // Get Presigned URL
                const presignedRes = await fetch('/api/admin/app-version/upload-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: apkFile.name,
                        contentType: 'application/vnd.android.package-archive',
                        size: apkFile.size
                    })
                })

                if (!presignedRes.ok) {
                    const err = await presignedRes.json()
                    throw new Error(err.error || 'Gagal mendapatkan URL upload')
                }

                const { uploadUrl, key } = await presignedRes.json()
                apkKey = key
                apkFilename = apkFile.name
                apkSize = apkFile.size

                // Upload to R2 directly
                setStatus('Mengupload file...')

                const xhr = new XMLHttpRequest()

                await new Promise((resolve, reject) => {
                    xhr.upload.addEventListener('progress', (event) => {
                        if (event.lengthComputable) {
                            const percentComplete = (event.loaded / event.total) * 100
                            setUploadProgress(Math.round(percentComplete))
                        }
                    })

                    xhr.onreadystatechange = () => {
                        if (xhr.readyState === 4) {
                            if (xhr.status === 200) {
                                resolve(true)
                            } else {
                                reject(new Error('Gagal mengupload file ke storage'))
                            }
                        }
                    }

                    xhr.onerror = () => reject(new Error('Network error saat upload'))

                    xhr.open('PUT', uploadUrl)
                    xhr.setRequestHeader('Content-Type', 'application/vnd.android.package-archive')
                    xhr.send(apkFile)
                })
            }

            // 2. Submit metadata ke backend
            setStatus('Menyimpan data...')

            const form = new FormData()
            if (formData.version) form.append('version', formData.version)
            if (formData.buildNumber) form.append('buildNumber', formData.buildNumber)
            if (formData.versionCode) form.append('versionCode', formData.versionCode)
            form.append('platform', formData.platform)
            form.append('releaseNotes', formData.releaseNotes)
            form.append('isForceUpdate', formData.isForceUpdate.toString())
            if (formData.minVersion) form.append('minVersion', formData.minVersion)

            // Kirim info file yang sudah diupload (bukan filenya lagi) atau file jika force local
            if (isForceLocal) {
                if (apkFile) form.append('apk', apkFile)
                form.append('forceLocal', 'true')
                setStatus('Mengupload ke Local Storage...')
            } else if (apkKey) {
                form.append('uploadedKey', apkKey)
                form.append('uploadedFilename', apkFilename)
                form.append('uploadedSize', apkSize.toString())
            }

            const res = await fetch('/api/admin/app-version', {
                method: 'POST',
                body: form
            })

            const data = await res.json()
            if (data.success) {
                onSuccess()
            } else {
                alert(data.error || 'Gagal menyimpan versi')
            }
        } catch (error: unknown) {
            console.error('Error uploading version:', error)
            const msg = error instanceof Error ? error.message : 'Terjadi kesalahan'
            alert(msg)
        } finally {
            setLoading(false)
            setUploadProgress(0)
            setStatus('')
        }
    }

    const hasApk = !!apkFile

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Upload Versi Baru"
            size="lg"
        >
                <div className="space-y-4">
                    <form id="upload-form" onSubmit={handleSubmit} className="space-y-4">
                        {/* APK File - prioritas utama */}
                        <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-4 border-2 border-dashed border-indigo-300">
                            <label htmlFor="upload-apk-file" className="block text-sm font-medium mb-2 text-indigo-700 dark:text-indigo-300">
                                📦 File APK
                            </label>
                            <input
                                id="upload-apk-file"
                                type="file"
                                accept=".apk"
                                onChange={(e) => setApkFile(e.target.files?.[0] || null)}
                                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                disabled={loading}
                            />
                            {apkFile ? (
                                <p className="text-sm text-green-600 mt-2">
                                    ✅ {apkFile.name} ({(apkFile.size / (1024 * 1024)).toFixed(1)} MB)
                                    <br />
                                    <span className="text-xs">Versi akan otomatis terdeteksi dari APK (Server-side parsing)</span>
                                </p>
                            ) : (
                                <p className="text-xs text-gray-500 mt-2">
                                    💡 Upload APK untuk auto-detect Versi, Build, dan Code
                                </p>
                            )}

                            {/* Progress Bar & Skeleton Loading */}
                            {loading && (
                                <div className="mt-4 space-y-2">
                                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                                        <span className="flex items-center gap-2">
                                            {uploadProgress === 0 && <div className="w-3 h-3 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></div>}
                                            {status || 'Menyiapkan upload...'}
                                        </span>
                                        <span>{uploadProgress}%</span>
                                    </div>
                                    
                                    {uploadProgress === 0 ? (
                                        // Skeleton / Indeterminate Loading
                                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden">
                                            <div className="bg-indigo-300 dark:bg-indigo-700 h-2.5 rounded-full w-full animate-pulse"></div>
                                        </div>
                                    ) : (
                                        // Actual Progress Bar
                                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                                            <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Manual input - hanya tampil jika tidak ada APK */}
                        {!hasApk && (
                            <>
                                {/* Divider */}
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-gray-300"></div>
                                    </div>
                                    <div className="relative flex justify-center text-xs">
                                        <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                                            Atau isi manual
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label htmlFor="upload-version" className="block text-sm font-medium mb-1">
                                            Versi <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            id="upload-version"
                                            type="text"
                                            placeholder="1.0.54"
                                            value={formData.version}
                                            onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                            disabled={loading}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="upload-build-number" className="block text-sm font-medium mb-1">
                                            Build <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            id="upload-build-number"
                                            type="number"
                                            placeholder="47"
                                            value={formData.buildNumber}
                                            onChange={(e) => setFormData({ ...formData, buildNumber: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                            disabled={loading}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="upload-version-code" className="block text-sm font-medium mb-1">
                                            Code <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            id="upload-version-code"
                                            type="number"
                                            placeholder="47"
                                            value={formData.versionCode}
                                            onChange={(e) => setFormData({ ...formData, versionCode: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                            disabled={loading}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        <div>
                            <label htmlFor="upload-platform" className="block text-sm font-medium mb-1">Platform</label>
                            <select
                                id="upload-platform"
                                value={formData.platform}
                                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                disabled={loading}
                            >
                                <option value="android">Android</option>
                                <option value="ios">iOS</option>
                                <option value="all">Semua Platform</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="upload-release-notes" className="block text-sm font-medium mb-1">Catatan Rilis</label>
                            <textarea
                                id="upload-release-notes"
                                value={formData.releaseNotes}
                                onChange={(e) => setFormData({ ...formData, releaseNotes: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                rows={3}
                                placeholder="Apa yang baru di versi ini?"
                                disabled={loading}
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="forceUpdate"
                                checked={formData.isForceUpdate}
                                onChange={(e) => setFormData({ ...formData, isForceUpdate: e.target.checked })}
                                className="h-4 w-4"
                                disabled={loading}
                            />
                            <label htmlFor="forceUpdate" className="text-sm">
                                <span className="font-medium">Force Update</span>
                                <span className="text-gray-500"> - Pengguna wajib update</span>
                            </label>
                        </div>

                        {/* Force Local Option (Moved for visibility) */}
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="forceLocal"
                                checked={isForceLocal}
                                onChange={(e) => setIsForceLocal(e.target.checked)}
                                className="h-4 w-4"
                                disabled={loading}
                            />
                            <label htmlFor="forceLocal" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Simpan di Local Storage (Bypass R2)
                            </label>
                        </div>

                        <div>
                            <label htmlFor="upload-min-version" className="block text-sm font-medium mb-1">Minimum Versi (Opsional)</label>
                            <input
                                id="upload-min-version"
                                type="text"
                                placeholder="1.0.50"
                                value={formData.minVersion}
                                onChange={(e) => setFormData({ ...formData, minVersion: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                disabled={loading}
                            />
                            <p className="text-xs text-gray-500 mt-1">Versi di bawah ini akan dipaksa update</p>
                        </div>
                    </form>
                </div>

                <ModalFooter>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                        disabled={loading}
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        form="upload-form"
                        disabled={loading}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Proses...</span>
                            </>
                        ) : 'Upload'}
                    </button>
                </ModalFooter>
        </Modal>
    )
}

// Edit Modal Component
function EditVersionModal({ version, onClose, onSuccess }: { version: AppVersion; onClose: () => void; onSuccess: () => void }) {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        releaseNotes: version.releaseNotes || '',
        isForceUpdate: version.isForceUpdate,
        isActive: version.isActive,
        minVersion: version.minVersion || ''
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const res = await fetch(`/api/admin/app-version/${version.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            const data = await res.json()
            if (data.success) {
                onSuccess()
            } else {
                alert(data.error || 'Gagal update versi')
            }
        } catch (error: unknown) {
            console.error('Error updating version:', error)
            alert('Terjadi kesalahan')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={`Edit v${version.version}`}
            size="md"
        >
                <div className="space-y-4">
                    <form id="edit-form" onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="edit-release-notes" className="block text-sm font-medium mb-1">Catatan Rilis</label>
                            <textarea
                                id="edit-release-notes"
                                value={formData.releaseNotes}
                                onChange={(e) => setFormData({ ...formData, releaseNotes: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                rows={4}
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="forceUpdateEdit"
                                checked={formData.isForceUpdate}
                                onChange={(e) => setFormData({ ...formData, isForceUpdate: e.target.checked })}
                                className="h-4 w-4"
                            />
                            <label htmlFor="forceUpdateEdit" className="text-sm font-medium">Force Update</label>
                        </div>

                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="isActive"
                                checked={formData.isActive}
                                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                className="h-4 w-4"
                            />
                            <label htmlFor="isActive" className="text-sm font-medium">Aktif</label>
                        </div>

                        <div>
                            <label htmlFor="edit-min-version" className="block text-sm font-medium mb-1">Minimum Versi (Opsional)</label>
                            <input
                                id="edit-min-version"
                                type="text"
                                placeholder="1.0.50"
                                value={formData.minVersion}
                                onChange={(e) => setFormData({ ...formData, minVersion: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                            />
                            <p className="text-xs text-gray-500 mt-1">Kosongkan jika versi ini tidak ingin memaksa minimum versi tertentu</p>
                        </div>
                    </form>
                </div>

                <ModalFooter>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        form="edit-form"
                        disabled={loading}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {loading ? 'Menyimpan...' : 'Simpan'}
                    </button>
                </ModalFooter>
        </Modal>
    )
}
