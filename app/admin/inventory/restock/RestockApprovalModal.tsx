"use client";

import { type RefObject, useEffect, useRef } from "react";
import { FiCheck, FiX } from "react-icons/fi";

import { Modal } from "@/components/ui/Modal";

import {
  APPROVAL_OVERALL_NOTE_MAX_LENGTH,
  getEffectiveSubstitute,
  getSubstituteOptions,
  isDecisionNoteRequired,
} from "./approvalUtils";
import { RestockApprovalItemRow } from "./RestockApprovalItemRow";
import { RestockProblemList } from "./RestockProblemList";
import type { Barang, PurchaseRequest } from "./types";
import type { RestockApprovalController } from "./useRestockApproval";

const PROBLEM_LIST_ID = "restock-approval-problems";
const OVERALL_NOTE_ID = "restock-approval-note";

interface RestockApprovalModalProps {
  approval: RestockApprovalController;
  allBarangs: Barang[];
}

/**
 * Modal "Keputusan Pengajuan": approver memutuskan tiap baris barang/jasa lalu
 * menyetujui atau menolak seluruh pengajuan.
 */
export function RestockApprovalModal({
  approval,
  allBarangs,
}: RestockApprovalModalProps) {
  const { request, isSubmitting } = approval;
  const rejectButtonRef = useRestoreFocusAfterRejectConfirmation(
    approval.isRejectConfirming,
  );

  return (
    <Modal
      isOpen={!!request}
      onClose={approval.close}
      title="Keputusan Pengajuan"
      size="3xl"
    >
      {request && (
        <div className="space-y-6 p-6">
          <RestockApprovalHeader request={request} />
          <RestockApprovalLines approval={approval} allBarangs={allBarangs} />
          <RestockApprovalOverallNote approval={approval} />
          {!isSubmitting && approval.problems.length > 0 && (
            <RestockProblemList
              id={PROBLEM_LIST_ID}
              problems={approval.problems}
              title="Belum bisa disetujui:"
            />
          )}
          {approval.isRejectConfirming ? (
            <RestockRejectConfirmation approval={approval} />
          ) : (
            <RestockApprovalFooter
              approval={approval}
              rejectButtonRef={rejectButtonRef}
            />
          )}
        </div>
      )}
    </Modal>
  );
}

function RestockApprovalHeader({ request }: { request: PurchaseRequest }) {
  const fields = [
    { label: "Nomor", value: request.nomorRequest },
    { label: "Pemohon", value: request.requester?.name || "-" },
    { label: "Gudang", value: request.gudang?.nama || "-" },
  ];

  return (
    <div className="space-y-3">
      <dl className="grid gap-3 sm:grid-cols-3">
        {fields.map((field) => (
          <div
            key={field.label}
            className="rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900"
          >
            <dt className="text-[10px] font-bold uppercase text-gray-400">
              {field.label}
            </dt>
            <dd className="text-sm font-bold text-gray-900 dark:text-white">
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
        <span className="block text-[10px] font-bold uppercase text-gray-400">
          Keterangan
        </span>
        {request.keterangan || "-"}
      </div>
    </div>
  );
}

function RestockApprovalLines({
  approval,
  allBarangs,
}: RestockApprovalModalProps) {
  const { request, decisions, isSubmitting } = approval;
  if (!request) return null;
  const jasaItems = request.jasaItems ?? [];
  const barangById = new Map(allBarangs.map((barang) => [barang.id, barang]));

  return (
    <div className="space-y-5">
      {request.items.length > 0 && (
        <section className="space-y-3" aria-label="Keputusan barang">
          <h3 className="px-1 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
            Barang
          </h3>
          {request.items.map((item) => {
            const decision = decisions.items[item.id];
            if (!decision) return null;
            // Baris yang ditolak dikirim tanpa pengganti, jadi tampilkan barang aslinya.
            const substituteId =
              decision.keputusan === "APPROVED"
                ? getEffectiveSubstitute(decision, item.barangId)
                : null;
            const substitute = substituteId
              ? barangById.get(substituteId)
              : undefined;
            return (
              <RestockApprovalItemRow
                key={item.id}
                lineId={item.id}
                name={item.barang.nama}
                kode={item.barang.kode}
                satuan={substitute?.satuan ?? item.barang.satuan}
                requestedQuantity={item.jumlah}
                decision={decision}
                isNoteRequired={isDecisionNoteRequired(
                  decision,
                  item,
                  item.barangId,
                )}
                onChange={(patch) =>
                  approval.updateLineDecision("items", item.id, patch)
                }
                substitution={{
                  options: getSubstituteOptions(
                    allBarangs,
                    request,
                    decisions,
                    item.id,
                  ),
                  selectedName: substitute?.nama ?? null,
                }}
                disabled={isSubmitting}
              />
            );
          })}
        </section>
      )}

      {jasaItems.length > 0 && (
        <section className="space-y-3" aria-label="Keputusan jasa">
          <h3 className="px-1 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
            Jasa
          </h3>
          {jasaItems.map((item) => {
            const decision = decisions.jasaItems[item.id];
            if (!decision) return null;
            return (
              <RestockApprovalItemRow
                key={item.id}
                lineId={item.id}
                name={item.jasa.nama}
                kode={item.jasa.kode}
                satuan={item.jasa.satuan}
                requestedQuantity={item.jumlah}
                decision={decision}
                isNoteRequired={isDecisionNoteRequired(decision, item)}
                onChange={(patch) =>
                  approval.updateLineDecision("jasaItems", item.id, patch)
                }
                disabled={isSubmitting}
              />
            );
          })}
        </section>
      )}
    </div>
  );
}

function RestockApprovalOverallNote({
  approval,
}: {
  approval: RestockApprovalController;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={OVERALL_NOTE_ID}
        className="px-1 text-xs font-bold uppercase text-gray-400"
      >
        Catatan keputusan
      </label>
      <textarea
        id={OVERALL_NOTE_ID}
        rows={3}
        maxLength={APPROVAL_OVERALL_NOTE_MAX_LENGTH}
        disabled={approval.isSubmitting}
        value={approval.overallNote}
        onChange={(event) => approval.setOverallNote(event.target.value)}
        placeholder="Wajib diisi bila menolak pengajuan"
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      />
    </div>
  );
}

function RestockApprovalFooter({
  approval,
  rejectButtonRef,
}: {
  approval: RestockApprovalController;
  rejectButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  const { isSubmitting, problems, rejectProblem } = approval;
  const isApproveDisabled = isSubmitting || problems.length > 0;
  const isRejectDisabled = isSubmitting || rejectProblem !== null;

  return (
    <div className="space-y-2">
      {rejectProblem && !isSubmitting && (
        <p className="text-right text-[11px] font-semibold text-gray-500 dark:text-gray-400">
          Tolak Pengajuan: {rejectProblem}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={approval.close}
          disabled={isSubmitting}
          className="flex-1 rounded-2xl bg-gray-100 px-4 py-4 font-bold text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
        >
          Batal
        </button>
        <button
          ref={rejectButtonRef}
          type="button"
          onClick={approval.requestReject}
          disabled={isRejectDisabled}
          aria-disabled={isRejectDisabled}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-4 font-bold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/40 dark:bg-gray-900"
        >
          <FiX aria-hidden="true" /> Tolak Pengajuan
        </button>
        <button
          type="button"
          onClick={() => void approval.approve()}
          disabled={isApproveDisabled}
          aria-disabled={isApproveDisabled}
          aria-describedby={problems.length > 0 ? PROBLEM_LIST_ID : undefined}
          className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-4 font-bold text-white shadow-lg transition-all hover:bg-emerald-700 disabled:opacity-50"
        >
          {isSubmitting ? (
            "Menyimpan..."
          ) : (
            <>
              <FiCheck aria-hidden="true" /> Setujui
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function RestockRejectConfirmation({
  approval,
}: {
  approval: RestockApprovalController;
}) {
  const { isSubmitting, request } = approval;
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Tombol Tolak Pengajuan yang tadi difokus sudah hilang; pindahkan fokus ke
  // pilihan aman di konfirmasi supaya pengguna keyboard tidak tersesat.
  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  return (
    <div
      role="alertdialog"
      aria-labelledby="restock-reject-confirm-title"
      className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20"
    >
      <p
        id="restock-reject-confirm-title"
        className="text-sm font-bold text-rose-800 dark:text-rose-200"
      >
        Tolak seluruh pengajuan {request?.nomorRequest}? Semua baris ditandai
        ditolak dan tidak ada PO yang dibuat.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          ref={cancelButtonRef}
          type="button"
          onClick={approval.cancelReject}
          disabled={isSubmitting}
          className="flex-1 rounded-2xl bg-white px-4 py-3 font-bold text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:bg-gray-900 dark:text-gray-200"
        >
          Kembali
        </button>
        <button
          type="button"
          onClick={() => void approval.reject()}
          disabled={isSubmitting}
          className="flex-1 rounded-2xl bg-rose-600 px-4 py-3 font-bold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
        >
          {isSubmitting ? "Menyimpan..." : "Ya, Tolak Pengajuan"}
        </button>
      </div>
    </div>
  );
}

/**
 * Kembalikan fokus ke tombol Tolak Pengajuan setelah konfirmasi ditutup lewat
 * "Kembali", karena tombol yang difokus sebelumnya ikut hilang. Dipasang di
 * modal (bukan footer) karena footer dilepas selama konfirmasi tampil.
 */
function useRestoreFocusAfterRejectConfirmation(isRejectConfirming: boolean) {
  const rejectButtonRef = useRef<HTMLButtonElement>(null);
  const wasConfirmingRef = useRef(isRejectConfirming);

  useEffect(() => {
    if (wasConfirmingRef.current && !isRejectConfirming) {
      rejectButtonRef.current?.focus();
    }
    wasConfirmingRef.current = isRejectConfirming;
  }, [isRejectConfirming]);

  return rejectButtonRef;
}
