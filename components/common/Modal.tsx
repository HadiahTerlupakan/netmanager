"use client"

import React from 'react'

type ModalProps = {
  open: boolean
  title?: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}

export default function Modal({ open, title, onClose, children, footer }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-800 dark:bg-gray-900">
        {title ? (
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
            <button onClick={onClose} className="rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-700">Tutup</button>
          </div>
        ) : null}
        <div className="min-h-[300px]">{children}</div>
        {footer ? <div className="mt-3 flex justify-end">{footer}</div> : null}
      </div>
    </div>
  )
}


