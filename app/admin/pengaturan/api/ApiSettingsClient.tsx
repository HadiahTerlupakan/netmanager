"use client";

import { HiArrowPath, HiCheckCircle } from "react-icons/hi2";
import { CaptchaSettings } from "@/components/admin/settings/CaptchaSettings";
import { R2Settings } from "@/components/admin/settings/R2Settings";
import { GeminiSettings } from "@/components/admin/settings/GeminiSettings";
import { StatusAlert } from "@/components/admin/logo/StatusAlert";
import { useApiSettings } from "./lib/useApiSettings";
import { API_SETTINGS_MESSAGES } from "./lib/constants";

export function ClientComponent() {
  const {
    loading,
    saving,
    testing,
    error,
    success,
    testSuccess,
    settings,
    visibility,
    loadSettings,
    handleSubmit,
    handleInputChange,
    toggleVisibility,
    handleTestR2Connection,
  } = useApiSettings();

  return (
    <div className="w-full space-y-5">
      <div className="mb-4 text-center md:text-left">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Pengaturan API & Cloud
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Kelola konfigurasi integrasi layanan pihak ketiga, AI, dan penyimpanan
          cloud
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <HiArrowPath className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {API_SETTINGS_MESSAGES.LOADING}
          </span>
        </div>
      ) : (
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6">
            <GeminiSettings
              enabled={settings.geminiEnabled}
              apiKey={settings.googleGeminiApiKey}
              showApiKey={visibility.showApiKey}
              setShowApiKey={() => toggleVisibility("showApiKey")}
              handleChange={handleInputChange}
              handleToggle={handleInputChange}
            />

            <R2Settings
              settings={settings}
              showR2Secret={visibility.showR2Secret}
              setShowR2Secret={() => toggleVisibility("showR2Secret")}
              handleChange={handleInputChange}
              handleToggle={handleInputChange}
              handleTestR2={handleTestR2Connection}
              testing={testing}
            />

            <CaptchaSettings />
          </div>

          {/* Feedback & Actions */}
          <div className="sticky bottom-4 z-10">
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex-1">
                {success && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 animate-in fade-in slide-in-from-left-2">
                    <HiCheckCircle className="w-5 h-5" />
                    <span className="text-sm font-bold">
                      {API_SETTINGS_MESSAGES.SUCCESS.SAVE}
                    </span>
                  </div>
                )}
                {testSuccess && (
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 animate-in fade-in slide-in-from-left-2">
                    <HiCheckCircle className="w-5 h-5" />
                    <span className="text-sm font-bold">
                      {API_SETTINGS_MESSAGES.SUCCESS.R2_TEST}
                    </span>
                  </div>
                )}
                {error && <StatusAlert type="error" message={error} />}
                {!success && !error && !testSuccess && (
                  <p className="text-xs text-gray-500 font-medium">
                    {API_SETTINGS_MESSAGES.INFO}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => void loadSettings()}
                  disabled={loading || saving}
                  className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all disabled:opacity-50"
                >
                  <HiArrowPath className="w-4 h-4" />
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-[2] md:flex-none inline-flex items-center justify-center gap-2 px-8 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <HiArrowPath className="w-4 h-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <HiCheckCircle className="w-4 h-4" />
                      Simpan Pengaturan
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
