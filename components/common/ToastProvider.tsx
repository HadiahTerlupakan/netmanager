"use client"

import { createContext, useContext, useState, useCallback, useEffect } from 'react'

type ToastType = 'success' | 'error' | 'info'

type Toast = {
  id: number
  type: ToastType
  title?: string
  message: string
  timeoutMs?: number
}

type ToastContextValue = {
  show: (t: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const show = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setItems((prev) => [...prev, { id, ...t }])
  }, [])

  useEffect(() => {
    const timers = items.map((it) => {
      const to = window.setTimeout(() => {
        setItems((prev) => prev.filter((p) => p.id !== it.id))
      }, it.timeoutMs ?? 4000)
      return to
    })
    return () => { timers.forEach(clearTimeout) }
  }, [items])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed z-50 right-4 bottom-4 space-y-2">
        {items.map((it) => (
          <div key={it.id} className={`min-w-[260px] max-w-sm rounded-md border px-3 py-2 shadow-sm text-sm ${
            it.type === 'error' ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200' :
            it.type === 'success' ? 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200' :
            'border-gray-300 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'
          }`}>
            {it.title && (<div className="font-semibold mb-0.5">{it.title}</div>)}
            <div>{it.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}


