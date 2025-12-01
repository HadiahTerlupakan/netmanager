'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { HiXMark } from 'react-icons/hi2'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    children: ReactNode
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
    showCloseButton?: boolean
}

export function Modal({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    showCloseButton = true,
}: ModalProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }

        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [isOpen])

    if (!isOpen) return null

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 safe-area-inset-top safe-area-inset-bottom"
            onClick={onClose}
        >
            <div
                className={`bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-2xl shadow-xl w-full ${sizeClasses[size]} max-h-[95vh] sm:max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 safe-area-inset-bottom`}
                onClick={(e) => e.stopPropagation()}
            >
                {(title || showCloseButton) && (
                    <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
                        {title && (
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white pr-4">
                                {title}
                            </h2>
                        )}
                        {showCloseButton && (
                            <button
                                onClick={onClose}
                                className="ml-auto min-w-[44px] min-h-[44px] p-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation flex items-center justify-center flex-shrink-0"
                                aria-label="Close modal"
                            >
                                <HiXMark className="w-6 h-6 sm:w-5 sm:h-5" />
                            </button>
                        )}
                    </div>
                )}
                <div className="p-5 sm:p-6">{children}</div>
            </div>
        </div>
    )
}
