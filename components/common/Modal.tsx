"use client"

import React from 'react'
import { Modal as UIModal, ModalFooter } from '@/components/ui/Modal'

type ModalProps = {
  open: boolean
  title?: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}

/**
 * Adapter component to maintain backward compatibility with components/common/Modal API
 * but render the modern components/ui/Modal visual.
 */
export default function Modal({ open, title, onClose, children, footer }: ModalProps) {
  return (
    <UIModal
      isOpen={open}
      onClose={onClose}
      title={title}
      size="2xl" // Default size in old modal was roughly this
    >
      {children}
      {footer && (
        <ModalFooter>
          {footer}
        </ModalFooter>
      )}
    </UIModal>
  )
}
