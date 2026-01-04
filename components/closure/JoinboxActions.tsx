"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useToast } from '@/components/common/ToastProvider'
import { StatusChangeButton } from '@/components/common/StatusChangeButton'
import { FiEye, FiEdit, FiTrash2 } from 'react-icons/fi'

export function JoinboxActions({ id, status }: { id: string; status?: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE' }) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { show } = useToast()

  async function handleDelete() {
    const res = await fetch(`/api/joinboxes/${id}`, { method: 'DELETE' })
    if (res.ok) {
      show({ type: 'success', title: 'Berhasil', message: 'JOINbox berhasil dihapus.' })
      router.refresh()
    } else {
      let msg = 'Gagal menghapus JOINbox.'
      try { const j = await res.json(); if (j?.error) msg = String(j.error) } catch {}
      show({ type: 'error', title: 'Tidak bisa dihapus', message: msg })
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {status && (
        <StatusChangeButton
          id={id}
          currentStatus={status}
          apiEndpoint={`/api/joinboxes/${id}`}
          entityName="JOINbox"
        />
      )}
      <Link href={`/admin/ftth/closure/${id}`} aria-label="Lihat" title="Lihat" className="inline-flex items-center justify-center h-8 w-8 rounded border border-gray-300 dark:border-gray-700">
        <FiEye className="h-4 w-4" />
      </Link>
      <Link href={`/admin/ftth/closure/${id}/edit`} aria-label="Edit" title="Edit" className="inline-flex items-center justify-center h-8 w-8 rounded border border-gray-300 dark:border-gray-700">
        <FiEdit className="h-4 w-4" />
      </Link>
      <div role="button" tabIndex={0} onClick={() => setConfirmOpen(true)} aria-label="Hapus" title="Hapus" className="inline-flex items-center justify-center h-8 w-8 rounded border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 cursor-pointer">
        <FiTrash2 className="h-4 w-4 shrink-0" />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Hapus JOINbox"
        description="Tindakan ini tidak bisa dibatalkan. Yakin ingin menghapus?"
        confirmText="Hapus"
        cancelText="Batal"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { setConfirmOpen(false); handleDelete() }}
      />
    </div>
  )
}


