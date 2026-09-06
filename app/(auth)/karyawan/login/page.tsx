import LoginForm from "@/components/auth/LoginForm";
import BackToPublicSiteLink from "@/components/auth/BackToPublicSiteLink";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Masuk Karyawan | NetManager",
};

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function KaryawanLoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const error = params.error;
  const session = await getServerSession(authOptions);

  // Redirect to dashboard if already logged in and has employee access
  if (session?.user && !error) {
    const user = session.user as { accessEmployeePanel?: boolean };
    if (user.accessEmployeePanel) {
      redirect("/karyawan/dashboard");
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            NetManager
          </h1>
          <p className="text-gray-600 dark:text-gray-400">Portal Karyawan</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Masuk Portal
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Masukkan kredensial karyawan Anda
            </p>
          </div>
          <Suspense
            fallback={
              <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
                Memuat formulir...
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
        <BackToPublicSiteLink />
      </div>
    </main>
  );
}
