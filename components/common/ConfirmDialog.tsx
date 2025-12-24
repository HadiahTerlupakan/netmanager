"use client"

import React from 'react'
import { Modal, ModalFooter } from '@/components/ui/Modal'

type ConfirmDialogProps = {
  open: boolean
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title = 'Konfirmasi',
  description = 'Apakah Anda yakin?',
  confirmText = 'Ya',
  cancelText = 'Tidak',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null
  return (
    <Modal
      isOpen={open}
      onClose={onCancel}
      title={title}
      size="sm"
    >
      <div className="text-gray-600 dark:text-gray-300">
        {description}
      </div>
      <ModalFooter>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 transition-colors shadow-sm"
        >
          {confirmText}
        </button>
      </ModalFooter>
    </Modal>
  )
}

export default ConfirmDialog


