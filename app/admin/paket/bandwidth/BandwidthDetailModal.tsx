"use client";

import { Modal } from "@/components/ui/Modal";

import { BandwidthDetailContent } from "@/app/admin/paket/bandwidth/components/BandwidthDetailContent";
import type { BandwidthDetail } from "@/app/admin/paket/bandwidth/lib/bandwidthTypes";
import { useApi } from "@/lib/hooks/useApi";

type BandwidthDetailModalProps = {
  open: boolean;
  onClose: () => void;
  bandwidthId: string | null;
};

export default function BandwidthDetailModal({
  open,
  onClose,
  bandwidthId,
}: BandwidthDetailModalProps) {
  const shouldFetch = open && bandwidthId;
  const { data, error, isLoading } = useApi<BandwidthDetail>(
    shouldFetch ? `/api/bandwidths/${bandwidthId}` : null,
  );

  const bandwidth: BandwidthDetail | null = data ?? null;
  const errorMessage = error
    ? error.message || "Gagal memuat detail bandwidth"
    : null;

  return (
    <Modal isOpen={open} onClose={onClose} title="Detail Bandwidth" size="2xl">
      <BandwidthDetailContent
        bandwidth={bandwidth}
        loading={isLoading}
        error={errorMessage}
      />
    </Modal>
  );
}
