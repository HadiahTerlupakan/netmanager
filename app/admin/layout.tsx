import Sidebar from '@/components/layout/Sidebar'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import SessionProviderWrapper from '@/components/providers/SessionProviderWrapper'
import ToastProvider from '@/components/common/ToastProvider'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session: any = await getServerSession(authConfig as any)
  if (!session) {
    redirect('/login?callbackUrl=/admin')
  }
  // Optional RBAC: hanya ADMIN
  if (session?.user?.role && session.user.role !== 'ADMIN') {
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


