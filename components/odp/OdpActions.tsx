"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/common/ToastProvider'
import { StatusChangeButton } from '@/components/common/StatusChangeButton'
import { FiEye, FiEdit, FiTrash2 } from 'react-icons/fi'

export function OdpActions({ id, status }: { id: string; status?: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE' }) {
  const router = useRouter()
  const { show } = useToast()

  async function handleDelete() {
    if (!confirm('Hapus ODP ini?')) return
    const res = await fetch(`/api/odps/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      let msg = 'Gagal menghapus ODP.'
      try { const j = await res.json(); if (j?.error) msg = String(j.error) } catch {}
      show({ type: 'error', title: 'Tidak bisa dihapus', message: msg })
      return
    }
    show({ type: 'success', title: 'Berhasil', message: 'ODP berhasil dihapus.' })
    router.refresh()
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {status && (
        <StatusChangeButton
          id={id}
          currentStatus={status}
          apiEndpoint={`/api/odps/${id}`}
          entityName="ODP"
        />
      )}
      <Link href={`/admin/ftth/odp/${id}`} aria-label="Lihat" title="Lihat" className="inline-flex items-center justify-center h-8 w-8 rounded border border-gray-300 dark:border-gray-700">
        <FiEye className="h-4 w-4" />
      </Link>
      <Link href={`/admin/ftth/odp/${id}/edit`} aria-label="Edit" title="Edit" className="inline-flex items-center justify-center h-8 w-8 rounded border border-gray-300 dark:border-gray-700">
        <FiEdit className="h-4 w-4" />
      </Link>
      <div role="button" tabIndex={0} onClick={handleDelete} aria-label="Hapus" title="Hapus" className="inline-flex items-center justify-center h-8 w-8 rounded border border-red-300 text-red-600 dark:border-red-700 dark:text-red-400 cursor-pointer">
        <FiTrash2 className="h-4 w-4 shrink-0" />
      </div>
    </div>
  )
}


