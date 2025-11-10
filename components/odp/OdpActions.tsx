"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/common/ToastProvider'
import { StatusChangeButton } from '@/components/common/StatusChangeButton'
import { HiEye, HiPencil, HiTrash } from 'react-icons/hi2'

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
        <HiEye className="h-4 w-4" />
      </Link>
      <Link href={`/admin/ftth/odp/${id}/edit`} aria-label="Edit" title="Edit" className="inline-flex items-center justify-center h-8 w-8 rounded border border-gray-300 dark:border-gray-700">
        <HiPencil className="h-4 w-4" />
      </Link>
      <button onClick={handleDelete} aria-label="Hapus" title="Hapus" className="inline-flex items-center justify-center h-8 w-8 rounded border border-red-300 text-red-600 dark:border-red-700 dark:text-red-400">
        <HiTrash className="h-4 w-4" />
      </button>
    </div>
  )
}


