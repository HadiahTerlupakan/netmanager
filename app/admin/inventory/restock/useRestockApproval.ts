"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

import { patchWithAuth } from "@/lib/api-client";

import {
  buildApprovalPayload,
  buildInitialApprovalDecisions,
  buildRejectPayload,
  getApprovalProblems,
  getRejectProblem,
} from "./approvalUtils";
import { showRestockError, showRestockWarning } from "./restockToasts";
import type {
  Barang,
  PurchaseRequest,
  RestockApprovalDecisions,
  RestockApprovalLineDecision,
  RestockApprovalLineKind,
  RestockApprovePayload,
  RestockRejectPayload,
} from "./types";
import { describeRestockClientError, readRestockErrorMessage } from "./utils";

const EMPTY_DECISIONS: RestockApprovalDecisions = { items: {}, jasaItems: {} };
const HTTP_CONFLICT = 409;

interface UseRestockApprovalInput {
  fetchData: () => Promise<void>;
  allBarangs: Barang[];
}

interface DecisionMessages {
  success: string;
  fallback: string;
}

const APPROVE_MESSAGES: DecisionMessages = {
  success: "Pengajuan disetujui",
  fallback: "Pengajuan belum disetujui. Coba sekali lagi.",
};

const REJECT_MESSAGES: DecisionMessages = {
  success: "Pengajuan ditolak",
  fallback: "Pengajuan belum ditolak. Coba sekali lagi.",
};

/**
 * State dan aksi modal "Keputusan Pengajuan": approver memutuskan tiap baris
 * (setujui/tolak, ubah jumlah, ganti barang) lalu menyetujui atau menolak
 * seluruh pengajuan lewat PATCH /api/inventory/restock/requests/[id].
 */
export function useRestockApproval({
  fetchData,
  allBarangs,
}: UseRestockApprovalInput) {
  const [request, setRequest] = useState<PurchaseRequest | null>(null);
  const [decisions, setDecisions] =
    useState<RestockApprovalDecisions>(EMPTY_DECISIONS);
  const [overallNote, setOverallNote] = useState("");
  const [isRejectConfirming, setIsRejectConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const problems = useMemo(
    () =>
      request
        ? getApprovalProblems({ request, decisions, overallNote, allBarangs })
        : [],
    [allBarangs, decisions, overallNote, request],
  );
  const rejectProblem = getRejectProblem(overallNote);

  const open = useCallback((target: PurchaseRequest) => {
    setRequest(target);
    setDecisions(buildInitialApprovalDecisions(target));
    setOverallNote("");
    setIsRejectConfirming(false);
  }, []);

  const close = useCallback(() => {
    if (isSubmitting) return;
    setRequest(null);
    setIsRejectConfirming(false);
  }, [isSubmitting]);

  const updateLineDecision = useCallback(
    (
      kind: RestockApprovalLineKind,
      lineId: string,
      patch: Partial<RestockApprovalLineDecision>,
    ) => {
      setDecisions((previous) => {
        const current = previous[kind][lineId];
        if (!current) return previous;
        return {
          ...previous,
          [kind]: { ...previous[kind], [lineId]: { ...current, ...patch } },
        };
      });
    },
    [],
  );

  const sendDecision = useCallback(
    async (
      target: PurchaseRequest,
      payload: RestockApprovePayload | RestockRejectPayload,
      messages: DecisionMessages,
    ) => {
      try {
        setIsSubmitting(true);
        const response = await patchWithAuth(
          `/api/inventory/restock/requests/${target.id}`,
          payload,
        );
        if (!response.ok) {
          showRestockError(
            await readRestockErrorMessage(response, messages.fallback),
          );
          if (response.status === HTTP_CONFLICT) {
            // Pengajuan sudah diputuskan orang lain atau isinya berubah: data
            // di modal basi, jadi tutup dan muat ulang daftar.
            setRequest(null);
            setIsRejectConfirming(false);
            await fetchData();
          }
          return;
        }

        const decided: { _poError?: string | null } | null = await response
          .json()
          .catch((): null => null);
        if (decided?._poError) {
          // Keputusan tetap tersimpan; yang gagal hanya pembuatan PO otomatis.
          showRestockWarning(decided._poError);
        } else {
          toast.success(messages.success);
        }
        setRequest(null);
        setIsRejectConfirming(false);
        await fetchData();
      } catch (error: unknown) {
        showRestockError(describeRestockClientError(error));
      } finally {
        setIsSubmitting(false);
      }
    },
    [fetchData],
  );

  const approve = useCallback(async () => {
    if (!request || isSubmitting) return;
    if (problems.length > 0) {
      showRestockError(
        `Pengajuan belum bisa disetujui:\n${problems.join("\n")}`,
      );
      return;
    }
    await sendDecision(
      request,
      buildApprovalPayload(request, decisions, overallNote),
      APPROVE_MESSAGES,
    );
  }, [decisions, isSubmitting, overallNote, problems, request, sendDecision]);

  const requestReject = useCallback(() => {
    if (getRejectProblem(overallNote)) return;
    setIsRejectConfirming(true);
  }, [overallNote]);

  const cancelReject = useCallback(() => {
    setIsRejectConfirming(false);
  }, []);

  const reject = useCallback(async () => {
    if (!request || isSubmitting) return;
    const problem = getRejectProblem(overallNote);
    if (problem) {
      showRestockError(problem);
      return;
    }
    await sendDecision(
      request,
      buildRejectPayload(overallNote),
      REJECT_MESSAGES,
    );
  }, [isSubmitting, overallNote, request, sendDecision]);

  return {
    request,
    decisions,
    overallNote,
    setOverallNote,
    problems,
    rejectProblem,
    isRejectConfirming,
    isSubmitting,
    open,
    close,
    updateLineDecision,
    approve,
    requestReject,
    cancelReject,
    reject,
  };
}

/** Kontrol modal keputusan yang diteruskan dari halaman ke komponen. */
export type RestockApprovalController = ReturnType<typeof useRestockApproval>;
