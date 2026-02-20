'use client'

import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from 'next-themes'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      // Explicitly set basePath to handle API route correctly
      basePath="/api/auth"
      // Reduce refetch frequency to avoid excessive requests
      refetchInterval={5 * 60} // 5 minutes
      refetchOnWindowFocus={true}
      // Refetch when tab becomes visible again
      refetchWhenOffline={false}
    >
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true} enableColorScheme={false}>
        {children}
        <Toaster position="top-right" />
      </ThemeProvider>
    </SessionProvider>
  )
}