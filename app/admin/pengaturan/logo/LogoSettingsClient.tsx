"use client";

import { HiArrowPath } from "react-icons/hi2";

import { useLogoSettings } from "./lib/useLogoSettings";
import { LOGO_MESSAGES } from "./lib/constants";
import type { LogoType } from "./lib/constants";
import { StatusAlert } from "@/components/admin/logo/StatusAlert";
import { LogoUploadCard } from "@/components/admin/logo/LogoUploadCard";

const LOGO_TYPES: LogoType[] = ["invoice", "aplikasi", "landing"];

export function ClientComponent() {
  const {
    loading,
    saving,
    error,
    success,
    logoStates,
    handleFileSelect,
    removeLogo,
  } = useLogoSettings();

  return (
    <div className="w-full space-y-5">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Pengaturan Logo
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Kelola logo untuk invoice, aplikasi, dan landing page
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <HiArrowPath className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              {LOGO_MESSAGES.LOADING}
            </span>
          </div>
        ) : (
          <div className="space-y-8">
            {LOGO_TYPES.map((type, index) => (
              <div key={type}>
                <LogoUploadCard
                  type={type}
                  preview={logoStates[type].preview}
                  saving={saving}
                  onFileSelect={handleFileSelect}
                  onRemove={removeLogo}
                />
                {index < LOGO_TYPES.length - 1 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 mt-8" />
                )}
              </div>
            ))}

            {/* Messages */}
            {success && (
              <StatusAlert
                type="success"
                message={LOGO_MESSAGES.SUCCESS.UPLOAD}
              />
            )}

            {error && <StatusAlert type="error" message={error} />}
          </div>
        )}
      </div>
    </div>
  );
}
