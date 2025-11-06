"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/common/ToastProvider'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

export function PoleActions({ id }: { id: string }) {
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
      <Link href={`/admin/ftth/pole/${id}`} aria-label="Lihat" title="Lihat" className="inline-flex items-center justify-center h-8 w-8 rounded border border-gray-300 dark:border-gray-700">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </Link>
      <Link href={`/admin/ftth/pole/${id}/edit`} aria-label="Edit" title="Edit" className="inline-flex items-center justify-center h-8 w-8 rounded border border-gray-300 dark:border-gray-700">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Z"/>
          <path d="M14.06 6.19l3.75 3.75L21 6.75l-3.75-3.75-3.19 3.19Z"/>
        </svg>
      </Link>
      <button onClick={() => setOpenConfirm(true)} aria-label="Hapus" title="Hapus" className="inline-flex items-center justify-center h-8 w-8 rounded border border-red-300 text-red-600 dark:border-red-700 dark:text-red-400">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
          <path d="M3 6h18"/>
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
        </svg>
      </button>
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


