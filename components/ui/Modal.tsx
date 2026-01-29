'use client'

import { useEffect, type ReactNode } from 'react'
import { HiXMark } from 'react-icons/hi2'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    description?: string
    children: ReactNode
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'
    showCloseButton?: boolean
}

export function Modal({
    isOpen,
    onClose,
    title,
    description,
    children,
    size = 'md',
    showCloseButton = true,
}: ModalProps) {
    // Lock body scroll when modal is open
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

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose()
            }
        }
        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [isOpen, onClose])

    if (!isOpen) return null

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl',
    }

    const titleId = title ? 'modal-title' : undefined
    const descriptionId = description ? 'modal-description' : undefined

    return (
        <div
            className="fixed inset-0 z-9999 flex items-end sm:items-center justify-center backdrop-blur-sm bg-black/30 animate-in fade-in duration-200 safe-area-inset-top safe-area-inset-bottom"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
        >
            <div
                className={`bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full ${sizeClasses[size]} max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 safe-area-inset-bottom`}
                onClick={(e) => e.stopPropagation()}
            >
                {(title || showCloseButton) && (
                    <div className="flex items-start justify-between p-5 sm:p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
                        {title && (
                            <div className="flex-1 pr-4">
                                <h2 
                                    id={titleId}
                                    className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white"
                                >
                                    {title}
                                </h2>
                                {description && (
                                    <p 
                                        id={descriptionId}
                                        className="text-sm text-gray-500 dark:text-gray-400 mt-1"
                                    >
                                        {description}
                                    </p>
                                )}
                            </div>
                        )}
                        {showCloseButton && (
                            <button
                                onClick={onClose}
                                className="ml-auto min-w-[44px] min-h-[44px] p-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation flex items-center justify-center shrink-0"
                                aria-label="Close modal"
                            >
                                <HiXMark className="w-6 h-6 sm:w-5 sm:h-5" />
                            </button>
                        )}
                    </div>
                )}
                <div className="overflow-y-auto flex-1">
                    <div className="p-5 sm:p-6">{children}</div>
                </div>
            </div>
        </div>
    )
}

// Helper component for modal footer
export function ModalFooter({ children }: { children: ReactNode }) {
    return (
        <div className="flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 sticky bottom-0">
            {children}
        </div>
    )
}

// Helper component for modal body with custom padding
export function ModalBody({ children, className = '' }: { children: ReactNode; className?: string }) {
    return (
        <div className={className || 'p-5 sm:p-6'}>
            {children}
        </div>
    )
}
