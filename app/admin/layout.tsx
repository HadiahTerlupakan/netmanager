import Sidebar from '@/components/layout/Sidebar'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import SessionProviderWrapper from '@/components/providers/SessionProviderWrapper'
import ToastProvider from '@/components/common/ToastProvider'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { redirect } from 'next/navigation'

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

  const session: any = await getServerSession(authConfig as any)
  if (!session) {
    redirect('/login?callbackUrl=/admin')
  }
  // Permitted roles: ADMIN, HR, FINANCE - these roles have access to different parts of the admin portal
  const permittedRoles = ['ADMIN', 'HR', 'FINANCE'];
  if (session?.user?.role && !permittedRoles.includes(session.user.role)) {
    redirect('/')
  }
  return (
    <SessionProviderWrapper session={session}>
      <ToastProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <Navbar />
            <main className="flex-1 overflow-y-auto">
              <div className="p-6">{children}</div>
            </main>
            <Footer />
          </div>
        </div>
      </ToastProvider>
    </SessionProviderWrapper>
  )
}


