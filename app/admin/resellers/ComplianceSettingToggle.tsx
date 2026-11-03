"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { useApi } from "@/lib/hooks/useApi";
import {
  fetchWithHandling,
  formatErrorMessage,
  isFetchError,
} from "@/lib/utils/fetch-wrapper";

export const COMPLIANCE_SETTING_URL = "/api/admin/resellers/compliance-setting";

/** Sakelar tata kelola reseller per tenant; semua default mati. */
export type ResellerGovernanceSetting = {
  readonly isComplianceRequired: boolean;
  readonly isSettlementSeparateApproverRequired: boolean;
};

type GovernanceSettingKey = keyof ResellerGovernanceSetting;

type GovernanceToggleProps = {
  readonly settingKey: GovernanceSettingKey;
  readonly title: string;
  readonly description: string;
  readonly enabledMessage: string;
  readonly disabledMessage: string;
  readonly canUpdate: boolean;
};

/** Membaca pengaturan tata kelola reseller tenant (dibagi antar-sakelar). */
function useResellerGovernanceSetting() {
  return useApi<ResellerGovernanceSetting>(COMPLIANCE_SETTING_URL);
}

/** Sakelar satu pengaturan tata kelola; PUT hanya mengirim sakelar ini. */
function GovernanceSettingToggle({
  settingKey,
  title,
  description,
  enabledMessage,
  disabledMessage,
  canUpdate,
}: GovernanceToggleProps) {
  const { data, mutate } = useResellerGovernanceSetting();
  const [isSaving, setIsSaving] = useState(false);
  const isEnabled = data?.[settingKey] ?? false;

  const toggle = async (next: boolean) => {
    setIsSaving(true);
    try {
      await fetchWithHandling(COMPLIANCE_SETTING_URL, {
        method: "PUT",
        body: JSON.stringify({ [settingKey]: next }),
      });
      await mutate();
      toast.success(next ? enabledMessage : disabledMessage);
    } catch (error) {
      toast.error(
        isFetchError(error) ? formatErrorMessage(error) : "Gagal menyimpan",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <label className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <input
        type="checkbox"
        className="mt-1"
        checked={isEnabled}
        disabled={!canUpdate || isSaving || !data}
        onChange={(event) => void toggle(event.target.checked)}
      />
      <span>
        <span className="block font-medium text-gray-900 dark:text-white">
          {title}
        </span>
        <span className="text-gray-500 dark:text-gray-400">{description}</span>
      </span>
    </label>
  );
}

/**
 * Sakelar tenant "Wajibkan kepatuhan reseller". Bila aktif, pelanggan baru
 * hanya bisa ditugaskan ke reseller yang izin dan PKS-nya lengkap; pelanggan
 * lama tidak terdampak.
 */
export function ComplianceSettingToggle({
  canUpdate,
}: {
  readonly canUpdate: boolean;
}) {
  return (
    <GovernanceSettingToggle
      settingKey="isComplianceRequired"
      title="Wajibkan kepatuhan reseller"
      description="Tolak penugasan pelanggan baru ke reseller yang belum punya NIB, KBLI, Sertifikat Standar terverifikasi, dan PKS aktif. Pelanggan yang sudah ada tidak terdampak."
      enabledMessage="Kepatuhan reseller kini wajib untuk pelanggan baru"
      disabledMessage="Kepatuhan reseller tidak lagi diwajibkan"
      canUpdate={canUpdate}
    />
  );
}

/**
 * Sakelar tenant "Pisahkan pembuat, penyetuju, dan pembayar settlement". Bila
 * aktif, pembuat settlement tidak bisa menyetujuinya dan penyetuju tidak bisa
 * mencatat pembayarannya.
 */
export function SettlementApproverSettingToggle({
  canUpdate,
}: {
  readonly canUpdate: boolean;
}) {
  return (
    <GovernanceSettingToggle
      settingKey="isSettlementSeparateApproverRequired"
      title="Pisahkan pembuat, penyetuju, dan pembayar settlement"
      description="Pembuat settlement komisi tidak boleh menyetujuinya, dan penyetuju tidak boleh mencatat pembayarannya; tiap tahap harus dilakukan pengguna lain."
      enabledMessage="Persetujuan dan pembayaran settlement kini wajib oleh pengguna berbeda"
      disabledMessage="Pemisahan penyetuju dan pembayar settlement dimatikan"
      canUpdate={canUpdate}
    />
  );
}
