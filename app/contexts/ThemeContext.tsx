'use client'

/**
 * Thin wrapper around next-themes that re-exports useTheme with a
 * convenience `toggleTheme` helper so existing consumers don't break.
 *
 * ThemeProvider configuration has moved to the session-provider files
 * where `<ThemeProvider>` from `next-themes` is rendered directly.
 */

import { useTheme as useNextTheme } from 'next-themes'

export function useTheme() {
  const { theme, setTheme, resolvedTheme, systemTheme } = useNextTheme()

  const toggleTheme = () => {
    // resolvedTheme accounts for 'system' → actual value
    const current = resolvedTheme ?? theme ?? 'dark'
    setTheme(current === 'dark' ? 'light' : 'dark')
  }

  return {
    theme: (resolvedTheme ?? theme ?? 'dark') as 'light' | 'dark',
    setTheme,
    toggleTheme,
    systemTheme,
  }
}
