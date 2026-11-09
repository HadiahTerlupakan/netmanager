"use client";

import { FiCheck, FiX } from "react-icons/fi";

import {
  RESTOCK_STAGE_COUNT,
  RESTOCK_STAGE_TITLES,
  type RestockProgress,
  type RestockStageNumber,
} from "./restockProgress";

interface RestockStageListProps {
  progress: RestockProgress;
  /** Kalimat keadaan sekarang; bawaan kalimat status pengajuan. */
  sentence?: string;
}

type StageState = "done" | "current" | "stopped" | "pending";

const STAGES = Array.from(
  { length: RESTOCK_STAGE_COUNT },
  (_, index) => (index + 1) as RestockStageNumber,
);
const VERIFICATION_STAGE: RestockStageNumber = 4;
/** Status akhir: tahap 4 ikut selesai. */
const FINISHED_KEYS = new Set(["COMPLETE", "COMPLETE_SHORT"]);

const STATE_TEXT: Record<Exclude<StageState, "stopped">, string> = {
  done: "selesai",
  current: "sedang berjalan",
  pending: "belum",
};

/** Teks pembaca layar; tahap yang berhenti memakai label status ("ditolak"). */
function describeStageState(
  state: StageState,
  progress: RestockProgress,
): string {
  if (state === "stopped")
    return `berhenti di sini, ${progress.label.toLowerCase()}`;
  return STATE_TEXT[state];
}

const MARKER_CLASS: Record<StageState, string> = {
  done: "border-green-700 bg-green-700 text-white",
  current: "border-indigo-700 bg-indigo-700 text-white",
  stopped: "border-red-700 bg-red-700 text-white",
  pending:
    "border-gray-400 bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

/**
 * Keadaan satu tahap. Pengajuan yang ditolak/dibatalkan berhenti di satu
 * tahap: tahap sebelumnya selesai, tahap itu "berhenti", sesudahnya belum.
 * Saat barang yang sudah dibeli mulai datang sebelum pembelian selesai,
 * tahap pembelian dan verifikasi sama-sama berjalan.
 */
export function getRestockStageState(
  stage: RestockStageNumber,
  progress: RestockProgress,
): StageState {
  if (progress.stoppedStage !== null) {
    if (stage < progress.stoppedStage) return "done";
    return stage === progress.stoppedStage ? "stopped" : "pending";
  }
  if (progress.stage === null) return "pending";
  if (stage < progress.stage) return "done";
  if (stage === progress.stage) {
    return FINISHED_KEYS.has(progress.key) ? "done" : "current";
  }
  return progress.isVerificationStarted && stage === VERIFICATION_STAGE
    ? "current"
    : "pending";
}

function renderStageMarker(state: StageState, stage: RestockStageNumber) {
  if (state === "done") return <FiCheck className="h-3.5 w-3.5" />;
  if (state === "stopped") return <FiX className="h-3.5 w-3.5" />;
  return stage;
}

/**
 * Empat tahap pengajuan untuk orang awam: Pengajuan → Persetujuan →
 * Pembelian → Verifikasi barang sampai, beserta kalimat keadaan sekarang.
 */
export function RestockStageList({
  progress,
  sentence = progress.sentence,
}: RestockStageListProps) {
  return (
    <div className="space-y-2">
      <ol
        aria-label="Tahap pengajuan"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {STAGES.map((stage) => {
          const state = getRestockStageState(stage, progress);
          return (
            <li
              key={stage}
              aria-current={
                state === "current" && stage === progress.stage
                  ? "step"
                  : undefined
              }
              className={`flex items-center gap-2 rounded-xl border p-2 text-sm ${state === "current" ? "border-indigo-300 bg-indigo-50 font-bold text-indigo-950 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-100" : "border-gray-200 text-gray-800 dark:border-gray-700 dark:text-gray-200"}`}
            >
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${MARKER_CLASS[state]}`}
              >
                {renderStageMarker(state, stage)}
              </span>
              <span className="min-w-0">
                {RESTOCK_STAGE_TITLES[stage]}
                <span className="sr-only">
                  , {describeStageState(state, progress)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="rounded-xl bg-gray-50 p-3 text-sm font-semibold text-gray-900 dark:bg-gray-900 dark:text-gray-100">
        Sekarang: {sentence}
      </p>
    </div>
  );
}
