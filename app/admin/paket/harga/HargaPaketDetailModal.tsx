"use client";

import { Modal } from "@/components/ui/Modal";

import { HargaDetailContent } from "@/app/admin/paket/harga/components/HargaDetailContent";
import type { HargaPaketDetail } from "@/app/admin/paket/harga/lib/hargaTypes";
import { useApi } from "@/lib/hooks/useApi";

type HargaPaketDetailModalProps = {
  open: boolean;
  onClose: () => void;
  paketId: string | null;
};

export default function HargaPaketDetailModal({
  open,
  onClose,
  paketId,
}: HargaPaketDetailModalProps) {
  const shouldFetch = open && paketId;
  const { data, error, isLoading } = useApi<HargaPaketDetail>(
    shouldFetch ? `/api/hargapakets/${paketId}` : null,
  );

  const paket: HargaPaketDetail | null = data ?? null;
  const errorMessage = error
    ? error.message || "Gagal memuat detail paket"
    : null;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Detail Harga Paket"
      size="2xl"
    >
      <HargaDetailContent
        paket={paket}
        loading={isLoading}
        error={errorMessage}
      />
    </Modal>
  );
}
