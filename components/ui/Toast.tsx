'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { HiCheckCircle, HiXCircle, HiInformationCircle, HiExclamationTriangle, HiXMark } from 'react-icons/hi2'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
    id: string
    type: ToastType
    message: string
    duration?: number
}

interface ToastContextType {
    showToast: (type: ToastType, message: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within ToastProvider')
    }
    return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const showToast = useCallback((type: ToastType, message: string, duration = 5000) => {
        const id = Math.random().toString(36).substring(7)
        const newToast: Toast = { id, type, message, duration }

        setToasts((prev) => [...prev, newToast])

        // Timer logic is now handled in the ToastItem component
    }, [])

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
    }, [])

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    )
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
    return (
        <div className="fixed bottom-4 left-4 right-4 sm:bottom-auto sm:top-4 sm:left-auto sm:right-4 z-50 space-y-2 max-w-sm sm:max-w-sm w-full sm:w-auto mx-auto sm:mx-0 safe-area-inset-bottom">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>
    )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
    const [isPaused, setIsPaused] = useState(false)
    const [progress, setProgress] = useState(100)

    // Handle auto-dismissal with pause on hover
    useEffect(() => {
        if (!toast.duration || toast.duration <= 0) return

        let startTime = Date.now()
        let remainingTime = toast.duration
        let timerId: NodeJS.Timeout

        const tick = () => {
            if (isPaused) {
                startTime = Date.now() // Reset start time while paused
                return
            }

            const elapsed = Date.now() - startTime
            remainingTime = Math.max(0, toast.duration! - elapsed)

            // Calculate progress percentage
            const newProgress = (remainingTime / toast.duration!) * 100
            setProgress(newProgress)

            if (remainingTime <= 0) {
                onRemove(toast.id)
            } else {
                timerId = requestAnimationFrame(tick) as unknown as NodeJS.Timeout
            }
        }

        // Start the timer
        timerId = requestAnimationFrame(tick) as unknown as NodeJS.Timeout

        return () => {
            if (timerId) cancelAnimationFrame(timerId as unknown as number)
        }
    }, [toast.id, toast.duration, isPaused, onRemove])

    const config = {
        success: {
            icon: HiCheckCircle,
            className: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
            iconColor: 'text-green-600 dark:text-green-400',
            progressBar: 'bg-green-500 dark:bg-green-400'
        },
        error: {
            icon: HiXCircle,
            className: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
            iconColor: 'text-red-600 dark:text-red-400',
            progressBar: 'bg-red-500 dark:bg-red-400'
        },
        warning: {
            icon: HiExclamationTriangle,
            className: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200',
            iconColor: 'text-yellow-600 dark:text-yellow-400',
            progressBar: 'bg-yellow-500 dark:bg-yellow-400'
        },
        info: {
            icon: HiInformationCircle,
            className: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
            iconColor: 'text-blue-600 dark:text-blue-400',
            progressBar: 'bg-blue-500 dark:bg-blue-400'
        },
    }

    const { icon: Icon, className, iconColor, progressBar } = config[toast.type]

    return (
        <div
            className={`relative overflow-hidden flex items-start gap-3 sm:gap-3 p-5 sm:p-4 rounded-lg border shadow-lg backdrop-blur-sm animate-in slide-in-from-bottom sm:slide-in-from-right duration-300 ${className}`}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            role="alert"
        >
            <Icon className={`w-6 h-6 sm:w-5 sm:h-5 mt-0.5 shrink-0 ${iconColor}`} />
            <p className="flex-1 text-base sm:text-sm font-medium leading-relaxed">{toast.message}</p>
            <button
                onClick={() => onRemove(toast.id)}
                className="shrink-0 hover:opacity-70 transition-opacity touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center -mt-2 -mr-2"
                aria-label="Close notification"
            >
                <HiXMark className="w-5 h-5 sm:w-4 sm:h-4" />
            </button>

            {/* Progress Bar */}
            {toast.duration && toast.duration > 0 && (
                <div className="absolute bottom-0 left-0 h-1 w-full bg-black/5 dark:bg-white/5">
                    <div
                        className={`h-full transition-all duration-100 ease-linear ${progressBar}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}
        </div>
    )
}
