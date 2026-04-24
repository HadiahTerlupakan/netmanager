import EmployeeSidebar from "@/components/layout/EmployeeSidebar";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import RealtimeProviderWrapper from "@/components/providers/RealtimeProviderWrapper";
import { ToastProvider } from "@/components/ui/Toast";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import AnnouncementBanner from "@/components/announcement/AnnouncementBanner";
import ForceLogoutListener from "@/components/auth/ForceLogoutListener";
import { PushNotificationProvider } from "@/components/notifications/PushNotificationContext";

import { ensureEmployeeAccess } from "@/lib/server-auth";

export default async function KaryawanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureEmployeeAccess(); // Strict check for employee portal access

  return (
    <RealtimeProviderWrapper>
      <ToastProvider>
        <ForceLogoutListener />
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
          <EmployeeSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <AnnouncementBanner portal="employee" />
            <PushNotificationProvider>
              <Navbar />
            </PushNotificationProvider>
            <main className="flex-1 overflow-y-auto">
              <div className="p-6">
                <ErrorBoundary>{children}</ErrorBoundary>
              </div>
            </main>
            <Footer />
          </div>
        </div>
      </ToastProvider>
    </RealtimeProviderWrapper>
  );
}
