'use client'

import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from 'next-themes'
import { SessionProvider } from 'next-auth/react'

export function Providers({ 
  children,
}: { 
  children: React.ReactNode
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true} enableColorScheme={false}>
      {typeof window !== 'undefined' ? (
        <SessionProvider>
          {children}
        </SessionProvider>
      ) : (
        children
      )}
      <Toaster position="top-right" />
    </ThemeProvider>
  )
}
