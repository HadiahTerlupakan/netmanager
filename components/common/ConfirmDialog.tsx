"use client"

import React from 'react'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

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
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          size="sm"
        >
          {cancelText}
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          variant="destructive"
          size="sm"
        >
          {confirmText}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default ConfirmDialog


