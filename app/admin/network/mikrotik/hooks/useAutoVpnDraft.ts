import { useEffect, useRef, useState } from "react";

import type { VpnDraft } from "@/app/admin/network/mikrotik/mikrotikFormShared";
import {
  postVpnDraft,
  VPN_DRAFT_URL,
  type VpnDraftRequest,
} from "@/components/mikrotik/VpnScriptModal";

/** Jeda setelah perubahan terakhir sebelum draft dibuat, agar klik beruntun jadi satu permintaan. */
export const AUTO_DRAFT_DEBOUNCE_MS = 500;

type UseAutoVpnDraftOptions = {
  isVpnMode: boolean;
  request: VpnDraftRequest;
  /** Draft yang sedang terpasang di form; kosong setelah VPN dimatikan atau draft dibuang. */
  currentDraftId?: string;
  onDraftReady: (draft: VpnDraft) => void;
};

/** Protokol dan urutan server yang menentukan isi draft. */
function draftKey(request: VpnDraftRequest) {
  return `${request.protocol}|${request.serverIds.join(",")}`;
}

/**
 * Membuat draft VPN sendiri saat mode VPN aktif dan draft form tidak cocok
 * dengan protokol/urutan server saat ini. Satu permintaan berjalan sekali
 * waktu; perubahan selama permintaan berjalan menghasilkan tepat satu
 * permintaan lagi setelahnya, dengan `previousDraftId` dari draft yang baru.
 */
export function useAutoVpnDraft({
  isVpnMode,
  request,
  currentDraftId,
  onDraftReady,
}: UseAutoVpnDraftOptions) {
  const [created, setCreated] = useState<{ draft: VpnDraft; key: string }>();
  const [failure, setFailure] = useState<{ message: string; key: string }>();
  const [isInFlight, setIsInFlight] = useState(false);
  const latest = useRef({ isVpnMode, request, onDraftReady });

  useEffect(() => {
    latest.current = { isVpnMode, request, onDraftReady };
  });

  // Menyalakan VPN lagi adalah percobaan baru; galat sesi sebelumnya tak berlaku.
  // Disesuaikan saat render, bukan di effect (aturan react-hooks/set-state-in-effect).
  const [wasVpnMode, setWasVpnMode] = useState(isVpnMode);
  if (wasVpnMode !== isVpnMode) {
    setWasVpnMode(isVpnMode);
    if (!isVpnMode) setFailure(undefined);
  }

  const key = draftKey(request);
  const isCurrent =
    created?.key === key && created.draft.draftId === currentDraftId;
  const needsDraft = isVpnMode && request.serverIds.length > 0 && !isCurrent;
  const error = needsDraft && failure?.key === key ? failure.message : null;

  useEffect(() => {
    if (!needsDraft || isInFlight || error) return;
    const timer = setTimeout(async () => {
      const sent = latest.current.request;
      setIsInFlight(true);
      const result = await postVpnDraft<VpnDraft>(VPN_DRAFT_URL, sent);
      setIsInFlight(false);
      // Draft yang selesai setelah VPN dimatikan tidak boleh mengisi form mode publik.
      if (!latest.current.isVpnMode) return;
      if ("error" in result) {
        setFailure({ message: result.error, key: draftKey(sent) });
        return;
      }
      setCreated({ draft: result.draft, key: draftKey(sent) });
      latest.current.onDraftReady(result.draft);
    }, AUTO_DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [needsDraft, key, isInFlight, error]);

  return {
    /** Draft yang cocok dengan isian form saat ini, atau null selama disiapkan. */
    draft: isCurrent ? created.draft : null,
    isPreparing: needsDraft && !error,
    error,
    retry: () => setFailure(undefined),
  };
}
