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
import { clientLogger } from "@/lib/client-logger";
import {
  PORTAL_PATHS,
  ERROR_MESSAGES,
  VALIDATION,
} from "./LoginForm.constants";
import {
  getErrorMessage,
  isRateLimitError,
  isDatabaseError,
  isCredentialsError,
  isLocalhostEnvironment,
  getTargetPath,
} from "./LoginForm.utils";

const schema = z.object({
  email: z
    .string()
    .min(VALIDATION.EMAIL_MIN_LENGTH, "Email wajib diisi")
    .pipe(z.email({ message: "Email tidak valid" })),
  password: z
    .string()
    .min(VALIDATION.PASSWORD_MIN_LENGTH, "Minimal 6 karakter"),
});

type FormValues = z.infer<typeof schema>;

function isEmployeePortal(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.pathname.startsWith(PORTAL_PATHS.EMPLOYEE)
  );
}

export default function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const errorParam = search.get("error");
  const errorMessage = getErrorMessage(errorParam);

  const isEmployee = isEmployeePortal();
  const defaultCallback = isEmployee
    ? PORTAL_PATHS.EMPLOYEE
    : PORTAL_PATHS.ADMIN;
  const callbackUrlParam = search.get("callbackUrl") || defaultCallback;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const handleLoginError = (error: string) => {
    if (isRateLimitError(error)) {
      clientLogger.warn("[LoginForm] Rate limit exceeded");
      router.push(`${PORTAL_PATHS.ERROR}?error=${encodeURIComponent(error)}`);
      return;
    }

    if (isDatabaseError(error)) {
      clientLogger.error("[LoginForm] Database connection error");
      setError("password", { message: ERROR_MESSAGES.DATABASE_ERROR });
      return;
    }

    if (isCredentialsError(error)) {
      setError("password", { message: ERROR_MESSAGES.INVALID_CREDENTIALS });
      return;
    }

    clientLogger.error("[LoginForm] Login error:", error);
    setError("password", { message: error || ERROR_MESSAGES.UNKNOWN });
  };

  const handleSuccessfulLogin = (responseUrl: string | null | undefined) => {
    const subdomain = getSubdomainFromWindow();
    const targetPath = getTargetPath(responseUrl, callbackUrlParam, isEmployee);

    if (isLocalhostEnvironment()) {
      window.location.assign(targetPath);
      return;
    }

    if (subdomain === "admin") {
      router.push(targetPath);
      return;
    }

    const adminUrl = getAdminUrl(targetPath);
    window.location.assign(adminUrl);
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await signIn("credentials", {
        redirect: false,
        identifier: values.email,
        password: values.password,
        portal: isEmployee ? "employee" : "admin",
        callbackUrl: callbackUrlParam,
      });

      if (!res) {
        setError("password", { message: ERROR_MESSAGES.UNEXPECTED });
        return;
      }

      if (res.error) {
        handleLoginError(res.error);
        return;
      }

      handleSuccessfulLogin(res.url);
    } catch (error) {
      clientLogger.error("[LoginForm] Unexpected error:", error);
      setError("password", { message: ERROR_MESSAGES.UNEXPECTED });
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
