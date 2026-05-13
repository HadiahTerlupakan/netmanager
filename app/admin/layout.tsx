import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import RealtimeProviderWrapper from "@/components/providers/RealtimeProviderWrapper";
import { ToastProvider } from "@/components/ui/Toast";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import AnnouncementBanner from "@/components/announcement/AnnouncementBanner";
import ForceLogoutListener from "@/components/auth/ForceLogoutListener";
import { PushNotificationManager } from "@/components/notifications/PushNotificationManager";
import { PushNotificationProvider } from "@/components/notifications/PushNotificationContext";
import { PermissionProvider } from "@/contexts/PermissionContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ensureAdminAccess } from "@/lib/server-auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Catatan: Subdomain routing di-handle oleh middleware
  // Di development, tetap bisa akses langsung dari localhost
  // Di production, bisa enforce subdomain dengan meng-uncomment kode di bawah
  // const headersList = await headers()
  // const host = headersList.get('host') || ''
  // if (host && !host.includes('localhost') && !host.startsWith('admin.')) {
  //   const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  //   redirect(`${protocol}://admin.${host.split(':')[0]}${host.includes(':') ? ':' + host.split(':')[1] : ''}`)
  // }

  await ensureAdminAccess(); // Strict check for admin portal access

  // Akses ke admin portal diizinkan untuk semua user yang terautentikasi.
  // Menu yang muncul diatur oleh Sidebar berdasarkan custom role permissions.
  // Jika user tidak memiliki permission apapun, mereka akan melihat dashboard kosong.
  return (
    <RealtimeProviderWrapper>
      <ToastProvider>
        <SettingsProvider>
          <PermissionProvider>
            <ForceLogoutListener />
            <div className="min-h-screen w-full overflow-x-hidden bg-gray-50 dark:bg-gray-950 flex">
              <Sidebar />
              <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden md:pl-72">
                <AnnouncementBanner portal="admin" />
                <PushNotificationProvider>
                  <PushNotificationManager className="mx-6 mt-4" />
                  <Navbar />
                </PushNotificationProvider>
                <main className="flex-1 overflow-y-auto overflow-x-hidden w-full">
                  <div className="p-6 w-full max-w-full overflow-x-hidden">
                    <ErrorBoundary>{children}</ErrorBoundary>
                  </div>
                </main>
                <Footer />
              </div>
            </div>
          </PermissionProvider>
        </SettingsProvider>
      </ToastProvider>
    </RealtimeProviderWrapper>
  );
}
