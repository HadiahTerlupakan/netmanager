import type { Metadata, Viewport } from 'next'
import FinanceLayoutClient from './layout-client'

export const metadata: Metadata = {
  title: 'Portal Finance - NetManager',
  description: 'Portal finance untuk mengelola tagihan, laporan keuangan, dan data finansial',
  icons: {
    icon: [
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#10b981', // Emerald green theme color untuk finance
}

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  // Catatan: Subdomain routing di-handle oleh middleware
  // Di development, tetap bisa akses langsung dari localhost
  // Di production, bisa enforce subdomain dengan meng-uncomment kode di bawah
  // const headersList = await headers()
  // const host = headersList.get('host') || ''
  // if (host && !host.includes('localhost') && !host.startsWith('finance.')) {
  //   const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  //   redirect(`${protocol}://finance.${host.split(':')[0]}${host.includes(':') ? ':' + host.split(':')[1] : ''}`)
  // }

  // TODO: Cek apakah user sudah login sebagai finance
  // Jika belum login dan bukan di halaman login, redirect ke login
  // const token = cookies().get('finance_token')
  // const pathname = usePathname()
  // if (!token && pathname !== '/finance/login') {
  //   redirect('/finance/login')
  // }

  return (
    <FinanceLayoutClient>{children}</FinanceLayoutClient>
  )
}

