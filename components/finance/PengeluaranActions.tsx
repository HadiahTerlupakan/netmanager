"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi2'
import Link from 'next/link'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

interface PengeluaranActionsProps {
  pengeluaranId: string
}

export default function PengeluaranActions({ pengeluaranId }: PengeluaranActionsProps) {
  const router = useRouter()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/pengeluaran/${pengeluaranId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        router.refresh()
        setShowDeleteDialog(false)
      } else {
        const data = await response.json()
        alert(data.error || 'Gagal menghapus pengeluaran')
      }
    } catch (error) {
      console.error('Error deleting pengeluaran:', error)
      alert('Terjadi kesalahan saat menghapus pengeluaran')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-center gap-2">
        <Link
          href={`/admin/finance/pengeluaran/${pengeluaranId}/edit`}
          className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
          title="Edit"
        >
          <HiOutlinePencil className="w-5 h-5" />
        </Link>
        <button
          onClick={() => setShowDeleteDialog(true)}
          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          title="Hapus"
        >
          <HiOutlineTrash className="w-5 h-5" />
        </button>
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        onCancel={() => setShowDeleteDialog(false)}
        onConfirm={() => {
          setShowDeleteDialog(false)
          handleDelete()
        }}
        title="Hapus Pengeluaran"
        description="Apakah Anda yakin ingin menghapus pengeluaran ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        cancelText="Batal"
      />
    </>
  )
}

