import { useState, type Dispatch, type SetStateAction } from "react";

import {
  applyRosVersion,
  applyVpnDraft,
  applyVpnMode,
  evaluateVpnConnectionTest,
  type MikrotikTestConnectionResult,
  type MikrotikVpnFormFields,
  type VpnDraft,
} from "@/app/admin/network/mikrotik/mikrotikFormShared";
import type {
  VpnApiCheckState,
  VpnDraftRequest,
} from "@/components/mikrotik/VpnScriptModal";

type UseVpnRouterModeOptions<T extends MikrotikVpnFormFields> = {
  formData: T;
  setFormData: Dispatch<SetStateAction<T>>;
  testResult: MikrotikTestConnectionResult | null;
  isTesting: boolean;
};

/**
 * State mode VPN form tambah router: toggle v7/VPN, daftar server, draft yang
 * kedaluwarsa saat server berubah, dan hasil test API milik draft aktif.
 */
export function useVpnRouterMode<T extends MikrotikVpnFormFields>({
  formData,
  setFormData,
  testResult,
  isTesting,
}: UseVpnRouterModeOptions<T>) {
  const [isDraftOutdated, setIsDraftOutdated] = useState(false);
  // Hasil test hanya berlaku untuk draft yang diuji; draft lain menunggu test baru.
  const [testedDraftId, setTestedDraftId] = useState<string | null>(null);
  const isVpnMode = formData.connectionMode === "VPN";

  const isCurrentDraftTested =
    isVpnMode &&
    !isDraftOutdated &&
    Boolean(formData.vpnDraftId) &&
    testedDraftId === formData.vpnDraftId;
  let apiCheck: VpnApiCheckState = null;
  if (isCurrentDraftTested) {
    apiCheck =
      isTesting || !testResult
        ? { status: "testing" }
        : evaluateVpnConnectionTest(testResult);
  }

  const draftRequest: VpnDraftRequest = {
    serverIds: formData.vpnServerIds ?? [],
    previousDraftId: formData.vpnDraftId,
    apiUsername: formData.apiUsername,
    apiPassword: formData.apiPassword,
  };

  return {
    isVpnMode,
    isDraftOutdated,
    apiCheck,
    isVpnTestPassed: apiCheck?.status === "passed",
    draftRequest,
    /** Dipanggil tepat sebelum test koneksi mode VPN dimulai. */
    markTestStarted: () => setTestedDraftId(formData.vpnDraftId ?? null),
    handleRosVersionChange: (isV7: boolean) => {
      setFormData((prev) => applyRosVersion(prev, isV7));
      if (!isV7) setIsDraftOutdated(false);
    },
    handleConnectionModeChange: (isVpn: boolean, serverIds: string[]) => {
      setFormData((prev) => applyVpnMode(prev, isVpn, serverIds));
      setIsDraftOutdated(false);
    },
    handleServerIdsChange: (serverIds: string[]) => {
      setFormData((prev) => ({ ...prev, vpnServerIds: serverIds }));
      if (formData.vpnDraftId) setIsDraftOutdated(true);
    },
    /** Membuang draft setelah aktivasi gagal sehingga script baru wajib dibuat. */
    discardDraft: () => {
      setFormData((prev): T => ({ ...prev, vpnDraftId: undefined }));
      setIsDraftOutdated(false);
    },
    handleDraftReady: (draft: VpnDraft) => {
      setFormData((prev) => applyVpnDraft(prev, draft));
      setIsDraftOutdated(false);
    },
  };
}
