import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'NetManager - Platform Manajemen Jaringan Terintegrasi',
  description: 'Kelola infrastruktur FTTH, perangkat jaringan, dan monitoring real-time dengan mudah. Platform manajemen jaringan terintegrasi untuk OLT, ONU, MikroTik, dan infrastruktur FTTH.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning className="h-full" data-scroll-behavior="smooth">
      <body className="h-full m-0">{children}</body>
    </html>
  )
}


