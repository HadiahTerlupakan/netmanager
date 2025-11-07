"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useToast } from '@/components/common/ToastProvider'
import Modal from '@/components/common/Modal'
import { StatusChangeButton } from '@/components/common/StatusChangeButton'

type KmzFile = {
  id: string
  name: string
  filename: string
  description: string | null
  lineColor: string
  isActive: boolean
  status?: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  fileSize: number
  createdAt: Date
}

export function KmzActions({ kmzFile }: { kmzFile: KmzFile }) {
  const router = useRouter()
  const { show } = useToast()
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [name, setName] = useState(kmzFile.name)
  const [description, setDescription] = useState(kmzFile.description || '')
  const [lineColor, setLineColor] = useState(kmzFile.lineColor || '#3388ff')
  const [status, setStatus] = useState<'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'>((kmzFile as any).status || 'AKTIF')
  const [isActive, setIsActive] = useState(kmzFile.isActive)
  const [saving, setSaving] = useState(false)

  async function handleDelete() {
    const res = await fetch(`/api/kmz/${kmzFile.id}`, { method: 'DELETE' })
    if (res.ok) {
      show({ type: 'success', title: 'Berhasil', message: 'File KMZ berhasil dihapus' })
      router.refresh()
    } else {
      let msg = 'Gagal menghapus file KMZ'
      try {
        const j = await res.json()
        if (j?.error) msg = String(j.error)
      } catch {}
      show({ type: 'error', title: 'Gagal', message: msg })
    }
  }

  async function handleUpdate() {
    setSaving(true)
    try {
      const res = await fetch(`/api/kmz/${kmzFile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: description || null, lineColor, isActive, status }),
      })

      if (res.ok) {
        show({ type: 'success', title: 'Berhasil', message: 'File KMZ berhasil diupdate' })
        setEditModalOpen(false)
        router.refresh()
      } else {
        const json = await res.json()
        const errorMessage = typeof json.error === 'string' ? json.error : 'Gagal mengupdate file KMZ'
        show({
          type: 'error',
          title: 'Gagal',
          message: errorMessage,
        })
      }
    } catch (error: any) {
      show({ type: 'error', title: 'Error', message: error.message || 'Terjadi kesalahan' })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive() {
    const newActive = !isActive
    setIsActive(newActive)
    
    try {
      const res = await fetch(`/api/kmz/${kmzFile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newActive }),
      })

      if (res.ok) {
        show({
          type: 'success',
          title: 'Berhasil',
          message: `File KMZ ${newActive ? 'diaktifkan' : 'dinonaktifkan'}`,
        })
        router.refresh()
      } else {
        setIsActive(!newActive) // Revert on error
        const json = await res.json()
        show({
          type: 'error',
          title: 'Gagal',
          message: json.error || 'Gagal mengupdate status file KMZ',
        })
      }
    } catch (error: any) {
      setIsActive(!newActive) // Revert on error
      show({ type: 'error', title: 'Error', message: error.message || 'Terjadi kesalahan' })
    }
  }

  const currentStatus = (kmzFile.status || status) as 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        {currentStatus && (
          <StatusChangeButton
            id={kmzFile.id}
            currentStatus={currentStatus}
            apiEndpoint={`/api/kmz/${kmzFile.id}`}
            entityName="KMZ"
          />
        )}
        <button
          onClick={handleToggleActive}
          aria-label={isActive ? 'Nonaktifkan' : 'Aktifkan'}
          title={isActive ? 'Nonaktifkan' : 'Aktifkan'}
          className={`inline-flex items-center justify-center h-8 w-8 rounded border ${
            isActive
              ? 'border-green-300 text-green-600 hover:bg-green-50 dark:border-green-700 dark:text-green-400'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-4 w-4"
          >
            {isActive ? (
              <>
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z" />
                <path d="M8 12l2 2 4-4" />
              </>
            ) : (
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2ZM8 12l8 8M16 12l-8 8" />
            )}
          </svg>
        </button>
        <button
          onClick={() => setEditModalOpen(true)}
          aria-label="Edit"
          title="Edit"
          className="inline-flex items-center justify-center h-8 w-8 rounded border border-gray-300 dark:border-gray-700"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-4 w-4"
          >
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Z" />
            <path d="M14.06 6.19l3.75 3.75L21 6.75l-3.75-3.75-3.19 3.19Z" />
          </svg>
        </button>
        <button
          onClick={() => setConfirmDeleteOpen(true)}
          aria-label="Hapus"
          title="Hapus"
          className="inline-flex items-center justify-center h-8 w-8 rounded border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-4 w-4"
          >
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>

      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit File KMZ">
        <div className="space-y-4">
          <div>
            <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Nama <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              required
            />
          </div>

          <div>
            <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Deskripsi
            </label>
            <textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="edit-lineColor" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Warna Garis
            </label>
            <div className="mt-1 flex items-center gap-3">
              <input
                id="edit-lineColor"
                type="color"
                value={lineColor}
                onChange={(e) => setLineColor(e.target.value)}
                className="h-10 w-20 cursor-pointer rounded-md border border-gray-300 dark:border-gray-700"
              />
              <input
                type="text"
                value={lineColor}
                onChange={(e) => {
                  const value = e.target.value
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                    setLineColor(value)
                  }
                }}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                placeholder="#3388ff"
                maxLength={7}
              />
            </div>
          </div>

          <div>
            <label htmlFor="edit-status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Status
            </label>
            <select
              id="edit-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE')}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="AKTIF">Aktif</option>
              <option value="NONAKTIF">Nonaktif</option>
              <option value="MAINTENANCE">Maintenance</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Aktif (tampilkan di map)</span>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm dark:border-gray-700"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleUpdate}
              disabled={saving || !name.trim()}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Hapus File KMZ"
        description="Tindakan ini tidak bisa dibatalkan. File akan dihapus dari sistem. Yakin ingin menghapus?"
        confirmText="Hapus"
        cancelText="Batal"
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          setConfirmDeleteOpen(false)
          handleDelete()
        }}
      />
    </>
  )
}

