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

type ComplianceSetting = { readonly isComplianceRequired: boolean };

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
  const { data, mutate } = useApi<ComplianceSetting>(COMPLIANCE_SETTING_URL);
  const [isSaving, setIsSaving] = useState(false);
  const isRequired = data?.isComplianceRequired ?? false;

  const toggle = async (next: boolean) => {
    setIsSaving(true);
    try {
      await fetchWithHandling(COMPLIANCE_SETTING_URL, {
        method: "PUT",
        body: JSON.stringify({ isComplianceRequired: next }),
      });
      await mutate();
      toast.success(
        next
          ? "Kepatuhan reseller kini wajib untuk pelanggan baru"
          : "Kepatuhan reseller tidak lagi diwajibkan",
      );
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
        checked={isRequired}
        disabled={!canUpdate || isSaving || !data}
        onChange={(event) => void toggle(event.target.checked)}
      />
      <span>
        <span className="block font-medium text-gray-900 dark:text-white">
          Wajibkan kepatuhan reseller
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          Tolak penugasan pelanggan baru ke reseller yang belum punya NIB, KBLI,
          Sertifikat Standar terverifikasi, dan PKS aktif. Pelanggan yang sudah
          ada tidak terdampak.
        </span>
      </span>
    </label>
  );
}
