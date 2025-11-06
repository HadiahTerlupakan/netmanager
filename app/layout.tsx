import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'NetManager',
  description: 'Admin app built with Next.js and Tailwind',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning className="h-full">
      <body className="h-full m-0">{children}</body>
    </html>
  )
}


