"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/common/ToastProvider'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { StatusChangeButton } from '@/components/common/StatusChangeButton'
import { FiEye, FiEdit, FiTrash2 } from 'react-icons/fi'

export function PoleActions({ id, status }: { id: string; status?: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE' }) {
  const router = useRouter()
  const { show } = useToast()
  const [openConfirm, setOpenConfirm] = useState(false)

  async function handleDeleteConfirmed() {
    const res = await fetch(`/api/poles/${id}`, { method: 'DELETE' })
    setOpenConfirm(false)
    if (!res.ok) {
      let msg = 'Gagal menghapus Pole.'
      try { const j = await res.json(); if (j?.error) msg = String(j.error) } catch {}
      show({ type: 'error', title: 'Tidak bisa dihapus', message: msg })
      return
    }
    show({ type: 'success', title: 'Berhasil', message: 'Pole berhasil dihapus.' })
    router.refresh()
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {status && (
        <StatusChangeButton
          id={id}
          currentStatus={status}
          apiEndpoint={`/api/poles/${id}`}
          entityName="Pole"
        />
      )}
      <Link href={`/admin/ftth/pole/${id}`} aria-label="Lihat" title="Lihat" className="inline-flex items-center justify-center h-8 w-8 rounded border border-gray-300 dark:border-gray-700">
        <FiEye className="h-4 w-4" />
      </Link>
      <Link href={`/admin/ftth/pole/${id}/edit`} aria-label="Edit" title="Edit" className="inline-flex items-center justify-center h-8 w-8 rounded border border-gray-300 dark:border-gray-700">
        <FiEdit className="h-4 w-4" />
      </Link>
      <div role="button" tabIndex={0} onClick={() => setOpenConfirm(true)} aria-label="Hapus" title="Hapus" className="inline-flex items-center justify-center h-8 w-8 rounded border border-red-300 text-red-600 dark:border-red-700 dark:text-red-400 cursor-pointer">
        <FiTrash2 className="h-4 w-4 shrink-0" />
      </div>
      <ConfirmDialog
        open={openConfirm}
        title="Hapus Pole?"
        description="Tindakan ini tidak dapat dibatalkan."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setOpenConfirm(false)}
      />
    </div>
  )
}


