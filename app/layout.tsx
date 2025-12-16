import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/providers/session-provider'

// Optimized font loading with next/font - eliminates render-blocking
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'NetManager - Platform Manajemen Jaringan Terintegrasi',
  description: 'Kelola infrastruktur FTTH, perangkat jaringan, dan monitoring real-time dengan mudah. Platform manajemen jaringan terintegrasi untuk OLT, ONU, MikroTik, dan infrastruktur FTTH.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning className={`h-full ${inter.variable}`} data-scroll-behavior="smooth">
      <body className={`h-full m-0 ${inter.className}`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
