import { useEffect, useState } from "react";
import { clientLogger } from "@/lib/client-logger";

/** Jeda polling status tunnel draft VPN. */
export const VPN_DRAFT_POLL_INTERVAL_MS = 5000;

/** Lama menunggu handshake sebelum petunjuk pemecahan masalah tampil. */
export const VPN_HANDSHAKE_HINT_DELAY_MS = 2 * 60 * 1000;

/** Tahap draft VPN seperti dilaporkan rute status. */
export type VpnDraftStage = "waiting" | "tunnel_up";

type DraftStageState = { draftId: string; stage: VpnDraftStage };

async function fetchDraftStage(draftId: string): Promise<VpnDraftStage | null> {
  const res = await fetch(`/api/mikrotik-routers/vpn-draft/${draftId}/status`);
  if (!res.ok) return null;
  const body = await res.json();
  return (body.data ?? body).stage ?? null;
}

/**
 * Polling status tunnel `draftId` tiap 5 detik sampai `tunnel_up`, atau
 * sampai `draftId` menjadi null / komponen dilepas. `isHintVisible` menyala
 * bila 2 menit berlalu tanpa handshake.
 */
export function useVpnDraftStatus(draftId: string | null) {
  const [stageState, setStageState] = useState<DraftStageState | null>(null);
  const [hintDraftId, setHintDraftId] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId) return;
    const stopPolling = () => {
      clearInterval(timer);
      clearTimeout(hintTimer);
    };
    const poll = async () => {
      try {
        const stage = await fetchDraftStage(draftId);
        if (!stage) return;
        setStageState({ draftId, stage });
        if (stage === "tunnel_up") stopPolling();
      } catch (error) {
        clientLogger.error("Gagal memeriksa status tunnel VPN", error);
      }
    };
    const timer = setInterval(poll, VPN_DRAFT_POLL_INTERVAL_MS);
    const hintTimer = setTimeout(
      () => setHintDraftId(draftId),
      VPN_HANDSHAKE_HINT_DELAY_MS,
    );
    void poll();
    return stopPolling;
  }, [draftId]);

  const stage: VpnDraftStage =
    draftId && stageState?.draftId === draftId ? stageState.stage : "waiting";
  return {
    stage,
    isHintVisible: hintDraftId === draftId && stage === "waiting",
  };
}
