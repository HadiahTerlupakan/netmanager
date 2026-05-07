"use client";

import {
  HiArrowPath,
  HiCheckCircle,
  HiExclamationCircle,
} from "react-icons/hi2";
import { CompanyProfileSettings } from "@/components/admin/settings/CompanyProfileSettings";
import { BillingSettings } from "@/components/admin/settings/BillingSettings";
import { NotificationSettings } from "@/components/admin/settings/NotificationSettings";
import { NetworkSettings } from "@/components/admin/settings/NetworkSettings";
import { TimezoneSettings } from "@/components/admin/settings/TimezoneSettings";
import { TenantSync } from "@/components/admin/settings/TenantSync";
import { useGeneralSettings } from "./useGeneralSettings";
import { Button } from "@/components/ui/Button";

export function ClientComponent() {
  const {
    settings,
    loading,
    saving,
    error,
    success,
    currentTime,
    backfilling,
    backfillResult,
    backfillError,
    isSuperAdmin,
    handleChange,
    handleCheckboxChange,
    handleBankChange,
    addBankAccount,
    removeBankAccount,
    handleSubmit,
    handleBackfill,
  } = useGeneralSettings();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Pengaturan Umum
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Kelola profil perusahaan, penagihan, dan konfigurasi sistem lainnya.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
            <HiExclamationCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <HiCheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <p className="text-sm text-green-800 dark:text-green-400 font-medium">
              Pengaturan berhasil disimpan!
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <CompanyProfileSettings
            settings={settings}
            handleChange={handleChange}
            handleBankChange={handleBankChange}
            addBankAccount={addBankAccount}
            removeBankAccount={removeBankAccount}
          />
          <BillingSettings settings={settings} handleChange={handleChange} />
          <NotificationSettings
            settings={settings}
            handleChange={handleChange}
            handleCheckboxChange={handleCheckboxChange}
          />
          <NetworkSettings settings={settings} handleChange={handleChange} />

          {isSuperAdmin && (
            <TenantSync
              backfilling={backfilling}
              backfillResult={backfillResult}
              backfillError={backfillError}
              handleBackfill={handleBackfill}
            />
          )}

          <TimezoneSettings
            timezone={settings.timezone}
            currentTime={currentTime}
            handleChange={handleChange}
          />

          <div className="sticky bottom-6 flex justify-end">
            <Button
              type="submit"
              disabled={saving || loading}
              variant="default"
              size="lg"
            >
              {saving ? (
                <>
                  <HiArrowPath className="w-5 h-5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Semua Pengaturan"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
