"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCustomerAuth } from "@/components/customer/CustomerAuthProvider";
import { Button } from "@/components/ui/Button";
import {
  DEFAULT_PUBLIC_APP_LOGO_URL,
  DEFAULT_PUBLIC_APP_NAME,
  usePublicBranding,
} from "@/hooks/usePublicBranding";
import {
  MdArrowBack,
  MdMailOutline,
  MdLockOutline,
  MdVisibility,
  MdVisibilityOff,
} from "react-icons/md";
import Image from "next/image";
import { getPublicSiteUrl } from "@/lib/utils/portal-url";

export default function CustomerLoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useCustomerAuth();
  const router = useRouter();
  const { branding, loading: isBrandingLoading } = usePublicBranding();
  const appLogoUrl = branding?.appLogoUrl || DEFAULT_PUBLIC_APP_LOGO_URL;
  const appName = branding?.namaAplikasi || DEFAULT_PUBLIC_APP_NAME;

  // Track image load failure to fallback to default; reset whenever
  // the source URL changes (prevValue comparator pattern).
  const [logoFailed, setLogoFailed] = useState(false);
  const [prevAppLogoUrl, setPrevAppLogoUrl] = useState(appLogoUrl);
  if (appLogoUrl !== prevAppLogoUrl) {
    setPrevAppLogoUrl(appLogoUrl);
    setLogoFailed(false);
  }
  const logoSrc = isBrandingLoading
    ? null
    : logoFailed
      ? DEFAULT_PUBLIC_APP_LOGO_URL
      : appLogoUrl;

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await login(identifier, password);
      if (result.success) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(result.error || "Login gagal");
      }
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f6f7f8] dark:bg-[#101922] font-sans text-[#111418] dark:text-white overflow-x-hidden antialiased flex flex-col items-center justify-center">
      <div className="relative flex h-full w-full max-w-md mx-auto flex-col bg-white dark:bg-[#101922] shadow-sm min-h-screen md:min-h-0 md:h-auto md:rounded-xl md:shadow-xl md:my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center p-4 pb-2 justify-between sticky top-0 z-10 bg-white/90 dark:bg-[#101922]/90 backdrop-blur-sm">
          {/* Anchor biasa, bukan `next/link`: tujuannya lintas host, dan
              `next/link` akan mencegat klik lalu menavigasi ke path yang sama
              di origin ini — yang di subdomain portal berarti kembali ke
              halaman login. */}
          <a
            href={getPublicSiteUrl()}
            aria-label="Kembali ke beranda"
            className="text-[#111418] dark:text-white flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <MdArrowBack className="text-2xl" />
          </a>
          <h2 className="text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-12">
            Masuk
          </h2>
        </div>

        <div className="flex-1 flex flex-col w-full justify-center">
          {/* Hero Logo */}
          <div className="flex items-center justify-center px-4 pt-4 pb-4">
            <div className="relative w-80 h-32">
              {logoSrc ? (
                <Image
                  src={logoSrc}
                  alt={`Logo ${appName}`}
                  fill
                  sizes="320px"
                  className="object-contain"
                  priority
                  onError={() => {
                    if (!logoFailed) {
                      setLogoFailed(true);
                    }
                  }}
                />
              ) : (
                <div
                  data-testid="customer-login-logo-skeleton"
                  className="h-full w-full animate-pulse rounded-2xl bg-gray-200/80 dark:bg-gray-800"
                />
              )}
            </div>
          </div>

          {/* Welcome Text */}
          <div className="px-4 pb-2 pt-4">
            <h1 className="text-[#111418] dark:text-white tracking-tight text-[28px] font-bold leading-tight text-center">
              Selamat Datang
            </h1>
            <p className="text-[#617589] dark:text-gray-400 text-base font-normal leading-normal pt-2 text-center">
              Kelola layanan internet Anda dengan mudah.
            </p>
          </div>

          {/* Login Form */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 px-4 py-6"
          >
            <label className="flex flex-col min-w-40 flex-1">
              <p className="text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2">
                Email atau ID Pelanggan
              </p>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#617589]">
                  <MdMailOutline className="text-[20px]" />
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white border border-[#dbe0e6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-0 focus:ring-2 focus:ring-[#0d9488]/50 focus:border-[#0d9488] h-12 placeholder:text-[#617589] pl-12 pr-4 text-base font-normal leading-normal transition-all"
                  placeholder="contoh@email.com"
                  required
                />
              </div>
            </label>

            <label className="flex flex-col min-w-40 flex-1">
              <div className="flex justify-between items-center pb-2">
                <p className="text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal">
                  Kata Sandi
                </p>
              </div>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#617589]">
                  <MdLockOutline className="text-[20px]" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white border border-[#dbe0e6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-0 focus:ring-2 focus:ring-[#0d9488]/50 focus:border-[#0d9488] h-12 placeholder:text-[#617589] pl-12 pr-12 text-base font-normal leading-normal transition-all"
                  placeholder="Masukkan kata sandi"
                  required
                />
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#617589] hover:text-[#0d9488]"
                >
                  {showPassword ? (
                    <MdVisibilityOff className="text-[20px]" />
                  ) : (
                    <MdVisibility className="text-[20px]" />
                  )}
                </Button>
              </div>
            </label>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50">
                <p className="text-sm text-red-600 dark:text-red-400 text-center font-medium">
                  {error}
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              loading={isLoading}
              className="w-full mt-4"
            >
              Masuk
            </Button>
          </form>

          <div className="p-4 pb-8 text-center mt-auto">
            <p className="text-[#617589] dark:text-gray-400 text-sm">
              Belum punya akun?
              <span className="text-[#0d9488] font-semibold hover:underline ml-1 cursor-pointer">
                Hubungi customer service
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
