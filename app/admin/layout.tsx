import Sidebar from '@/components/layout/Sidebar'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import SocketProviderWrapper from '@/components/providers/SocketProviderWrapper'
import ToastProvider from '@/components/common/ToastProvider'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import { getServerSession } from 'next-auth'
import AnnouncementBanner from '@/components/announcement/AnnouncementBanner'
import { authConfig } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ForceLogoutListener from '@/components/auth/ForceLogoutListener'

import { ensureAdminAccess } from '@/lib/server-auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Catatan: Subdomain routing di-handle oleh middleware
  // Di development, tetap bisa akses langsung dari localhost
  // Di production, bisa enforce subdomain dengan meng-uncomment kode di bawah
  // const headersList = await headers()
  // const host = headersList.get('host') || ''
  // if (host && !host.includes('localhost') && !host.startsWith('admin.')) {
  //   const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  //   redirect(`${protocol}://admin.${host.split(':')[0]}${host.includes(':') ? ':' + host.split(':')[1] : ''}`)
  // }

  await ensureAdminAccess() // Strict check for admin portal access

  // Akses ke admin portal diizinkan untuk semua user yang terautentikasi.
  // Menu yang muncul diatur oleh Sidebar berdasarkan custom role permissions.
  // Jika user tidak memiliki permission apapun, mereka akan melihat dashboard kosong.
  return (
    <SocketProviderWrapper>
      <ToastProvider>
        <ForceLogoutListener />
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <AnnouncementBanner portal="admin" />
            <Navbar />
            <main className="flex-1 overflow-y-auto">
              <div className="p-6">
                <ErrorBoundary>
                  {children}
                </ErrorBoundary>
              </div>
            </main>
            <Footer />
          </div>
        </div>
      </ToastProvider>
    </SocketProviderWrapper>
  )
}


