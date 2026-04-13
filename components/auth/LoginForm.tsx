"use client";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { HiLockClosed } from "react-icons/hi2";
import {
  getAdminUrl,
  getSubdomainFromWindow,
} from "@/lib/utils/subdomain-client";
import { Button } from "@/components/ui/Button";

const schema = z.object({
  email: z
    .string()
    .min(1, "Email wajib diisi")
    .pipe(z.email({ error: "Email tidak valid" })),
  password: z.string().min(6, "Minimal 6 karakter"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const errorParam = search.get("error");

  // Map error codes to human-readable messages
  const getErrorMessage = (code: string | null) => {
    if (!code) return null;
    switch (code) {
      case "AccessDenied":
        return "Akses ditolak. Anda tidak memiliki izin untuk mengakses portal ini.";
      case "CredentialsSignin":
        return "Email atau password salah.";
      case "SessionRequired":
        return "Silakan masuk untuk melanjutkan.";
      default:
        return "Terjadi kesalahan saat login. Silakan coba lagi.";
    }
  };

  const errorMessage = getErrorMessage(errorParam);
  // Check if we're on employee portal - if so, default callback to /karyawan
  const isEmployeePortal =
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/karyawan");
  const defaultCallback = isEmployeePortal ? "/karyawan" : "/admin";
  const callbackUrlParam = search.get("callbackUrl") || defaultCallback;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await signIn("credentials", {
        redirect: false,
        email: values.email,
        password: values.password,
        portal: isEmployeePortal ? "employee" : "admin",
        callbackUrl: callbackUrlParam, // Kirim path relatif ke NextAuth
      });

      if (!res) {
        setError("password", {
          message: "Terjadi kesalahan saat login. Silakan coba lagi.",
        });
        return;
      }

      if (res.error) {
        console.error("[LoginForm] Login error:", res.error);

        // Jika error terkait rate limiting, redirect ke halaman error
        if (
          res.error.includes("Terlalu banyak percobaan") ||
          res.error.includes("rate limit")
        ) {
          const errorUrl = `/error?error=${encodeURIComponent(res.error)}`;
          router.push(errorUrl);
          return;
        }

        // Error database connection
        if (res.error.includes("Database connection error")) {
          setError("password", {
            message:
              "Tidak dapat terhubung ke database. Silakan coba lagi beberapa saat.",
          });
          return;
        }

        // Error lainnya (email/password salah atau error umum)
        if (
          res.error.includes("credentials") ||
          res.error.includes("password")
        ) {
          setError("password", { message: "Email atau password salah" });
        } else {
          setError("password", {
            message:
              res.error || "Login gagal. Silakan periksa kredensial Anda.",
          });
        }
        return;
      }

      // Cek apakah kita sudah di admin subdomain
      const subdomain = getSubdomainFromWindow();
      // Extract path dari res.url (bisa berisi URL lengkap atau path relatif)
      const targetPathBase = res.url
        ? res.url.startsWith("http")
          ? new URL(res.url).pathname
          : res.url
        : callbackUrlParam;
      let targetPath = targetPathBase;

      // Use the appropriate callback based on portal type
      if (isEmployeePortal) {
        // For employee portal, ensure we stay on employee routes
        if (!targetPath.startsWith("/karyawan")) {
          targetPath = "/karyawan";
        }
      } else {
        // For admin portal, ensure we stay on admin routes
        if (!targetPath.startsWith("/admin")) {
          targetPath = "/admin";
        }
      }

      // Di development atau localhost
      const isLocalhost =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1" ||
          window.location.hostname.endsWith(".localhost"));

      console.log("[LoginForm] Login successful, redirecting...", {
        targetPath,
        subdomain,
        isLocalhost,
        isEmployeePortal,
        hostname: window.location.hostname,
        currentPath: window.location.pathname,
      });

      // KASUS KHUSUS LOCALHOST:
      // Kita tetap di localhost:3000 agar session cookie valid

      if (isLocalhost) {
        // Untuk localhost, gunakan window.location untuk memastikan redirect terjadi
        // dan session cookie ter-set dengan benar
        console.log("[LoginForm] Using window.location redirect for localhost");
        window.location.assign(targetPath);
        return;
      }

      // Default behavior
      if (subdomain === "admin") {
        router.push(targetPath);
        return;
      }

      // Di production dengan subdomain, redirect ke admin subdomain dengan URL lengkap
      const adminUrl = getAdminUrl(targetPath);
      window.location.assign(adminUrl);
    } catch (error) {
      console.error("[LoginForm] Unexpected error:", error);
      setError("password", {
        message: "Terjadi kesalahan tak terduga. Silakan coba lagi.",
      });
    }
  };

  return (
    <div className="w-full space-y-6">
      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400 font-medium text-center">
            {errorMessage}
          </p>
        </div>
      )}
      {/* Credentials Form */}
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
            placeholder="masukkan email Anda"
            {...register("email")}
          />
          {errors.email?.message && (
            <p className="text-sm font-medium text-red-600 dark:text-red-400 mt-1">
              {errors.email.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
            placeholder="masukkan password Anda"
            {...register("password")}
          />
          {errors.password?.message && (
            <p className="text-sm font-medium text-red-600 dark:text-red-400 mt-1">
              {errors.password.message}
            </p>
          )}
        </div>
        <Button
          type="submit"
          disabled={isSubmitting}
          loading={isSubmitting}
          size="lg"
          className="w-full"
        >
          <HiLockClosed className="w-4 h-4" />
          Masuk
        </Button>
      </form>
    </div>
  );
}
