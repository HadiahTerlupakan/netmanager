import { useState } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { HiOutlineCheck, HiOutlineGift, HiOutlineXMark } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { CLAIM_MODAL_TITLE_ID, getPendingClaim } from "./CanvasingListTypes";
import type { ClaimModalState } from "./CanvasingListTypes";

interface ClaimReviewModalProps {
  claimModal: ClaimModalState;
  onApprove: (claimId: string) => void;
  onReject: (claimId: string, notes: string) => void;
  onClose: () => void;
  onZoomImage: (url: string) => void;
}

/** Render modal for reviewing pending point claims. */
export default function ClaimReviewModal({
  claimModal,
  onApprove,
  onReject,
  onClose,
  onZoomImage,
}: ClaimReviewModalProps) {
  const [rejectNotes, setRejectNotes] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  if (!claimModal.open || !claimModal.item) {
    return null;
  }

  const claim = getPendingClaim(claimModal.item);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={CLAIM_MODAL_TITLE_ID}
        className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-800"
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <HiOutlineGift className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3
                id={CLAIM_MODAL_TITLE_ID}
                className="font-bold text-gray-900 dark:text-white"
              >
                Review Claim Poin
              </h3>
              <p className="text-xs text-gray-500">{claimModal.item.nama}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Tutup modal review claim poin"
            onClick={onClose}
          >
            <HiOutlineXMark className="h-5 w-5 text-gray-500" />
          </Button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {!claim && <p className="text-gray-500">Tidak ada claim pending</p>}
          {claim && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <span className="text-lg">⭐</span>
                  <span className="font-bold">+{claim.pointValue} Poin</span>
                  <span className="ml-auto text-xs text-amber-600 dark:text-amber-500">
                    {format(new Date(claim.createdAt), "dd MMM yyyy, HH:mm", {
                      locale: idLocale,
                    })}
                  </span>
                </div>
              </div>

              {claim.buktiUrls && claim.buktiUrls.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Bukti Foto:
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {claim.buktiUrls.map((url, index) => (
                      <div
                        key={`${claim.id}-${index}`}
                        className="relative aspect-square w-full"
                      >
                        <Image
                          src={url}
                          alt={`Bukti ${index + 1}`}
                          fill
                          sizes="150px"
                          className="cursor-zoom-in rounded-lg border border-gray-200 object-cover transition-opacity hover:opacity-80 dark:border-gray-600"
                          onClick={() => onZoomImage(url)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {claim.keterangan && (
                <div>
                  <p className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Keterangan:
                  </p>
                  <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                    {claim.keterangan}
                  </p>
                </div>
              )}

              {isRejecting && (
                <textarea
                  aria-label="Alasan penolakan claim"
                  value={rejectNotes}
                  onChange={(event) => setRejectNotes(event.target.value)}
                  className="min-h-24 w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  placeholder="Tuliskan alasan penolakan claim"
                />
              )}

              <div className="flex gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => onApprove(claim.id)}
                  disabled={claimModal.processing || isRejecting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-green-700 disabled:bg-green-400"
                >
                  <HiOutlineCheck className="h-5 w-5" />
                  Setujui
                </button>
                <button
                  type="button"
                  onClick={() => setIsRejecting(true)}
                  disabled={claimModal.processing || isRejecting}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  <HiOutlineXMark className="h-5 w-5" />
                  Tolak Claim
                </button>
                {isRejecting && (
                  <button
                    type="button"
                    onClick={() => onReject(claim.id, rejectNotes)}
                    disabled={claimModal.processing}
                    className="rounded-xl bg-red-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-red-700 disabled:bg-red-400"
                  >
                    Kirim Penolakan
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
