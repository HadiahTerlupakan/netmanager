"use client"

import React from 'react'
import { HiXMark } from 'react-icons/hi2'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 safe-area-inset-top safe-area-inset-bottom">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full h-full md:h-auto md:max-h-[90vh] md:w-full md:max-w-3xl md:rounded-lg border-0 md:border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 shadow-lg flex flex-col">
        {title ? (
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white pr-4">{title}</h3>
            <button 
              onClick={onClose} 
              className="touch-target rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
              aria-label="Tutup"
            >
              <HiXMark className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        ) : (
          <div className="absolute top-4 right-4 z-20 md:relative md:top-0 md:right-0">
            <button 
              onClick={onClose} 
              className="touch-target rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Tutup"
            >
              <HiXMark className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 min-h-0">
          {children}
        </div>
        {footer ? (
          <div className="flex-shrink-0 p-4 md:p-6 pt-0 border-t border-gray-200 dark:border-gray-700">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}


