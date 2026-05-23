"use client";

import { useState } from "react";
import Image from "next/image";

import { Modal } from "@/components/ui/Modal";
import { ImageLightbox } from "@/components/ui/ImageLightbox";

import type { Transfer } from "./useTransferList";

interface TransferDetailModalProps {
  transfer: Transfer | null;
  isOpen: boolean;
  onClose: () => void;
}

const KONDISI_BADGE_CLASS = {
  BARU: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  BEKAS:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  RUSAK: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
} as const;

export function TransferDetailModal({
  transfer,
  isOpen,
  onClose,
}: TransferDetailModalProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detail Transfer" size="lg">
      {!transfer ? null : (
        <div className="space-y-4">
          <TransferDetailSummary transfer={transfer} />
          <TransferGudangCards transfer={transfer} />

          {transfer.keterangan && (
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Keterangan
              </p>
              <p className="text-gray-900 dark:text-white">
                {transfer.keterangan}
              </p>
            </div>
          )}

          <TransferFotoGrid
            fotoBukti={transfer.fotoBukti}
            onOpenLightbox={(idx) => {
              setLightboxIndex(idx);
              setLightboxOpen(true);
            }}
          />
          {transfer.fotoBukti && transfer.fotoBukti.length > 0 && (
            <ImageLightbox
              images={transfer.fotoBukti}
              initialIndex={lightboxIndex}
              isOpen={lightboxOpen}
              onClose={() => setLightboxOpen(false)}
              alt="Foto Bukti Transfer"
            />
          )}

          <TransferRelatedTransactions transfer={transfer} />
        </div>
      )}
    </Modal>
  );
}

function TransferDetailSummary({ transfer }: { transfer: Transfer }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
      <div className="grid grid-cols-2 gap-4">
        <DetailField label="Kode Transfer" value={transfer.kodeTransfer} />
        <DetailField
          label="Tanggal"
          value={new Date(transfer.tanggal).toLocaleString("id-ID")}
        />
        <DetailField
          label="Barang"
          value={`${transfer.barang?.kode ?? "-"} - ${transfer.barang?.nama ?? "-"}`}
        />
        <DetailField
          label="Jumlah"
          value={`${transfer.jumlah} ${transfer.barang?.satuan ?? ""}`}
        />
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Kondisi</p>
          <span
            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
              KONDISI_BADGE_CLASS[transfer.kondisi]
            }`}
          >
            {transfer.kondisi}
          </span>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Diproses Oleh
          </p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-xs font-medium text-indigo-600 dark:text-indigo-400">
              {transfer.createdBy?.name?.charAt(0) || "?"}
            </div>
            <span className="font-medium text-gray-900 dark:text-white">
              {transfer.createdBy?.name || "System"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="font-medium text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function TransferGudangCards({ transfer }: { transfer: Transfer }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-2">
          Gudang Sumber
        </p>
        <p className="font-medium text-red-900 dark:text-red-300">
          {transfer.dariGudang?.kode} - {transfer.dariGudang?.nama}
        </p>
        {transfer.dariGudang?.lokasi && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            {transfer.dariGudang.lokasi}
          </p>
        )}
      </div>

      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-2">
          Gudang Tujuan
        </p>
        <p className="font-medium text-green-900 dark:text-green-300">
          {transfer.keGudang?.kode} - {transfer.keGudang?.nama}
        </p>
        {transfer.keGudang?.lokasi && (
          <p className="text-sm text-green-600 dark:text-green-400 mt-1">
            {transfer.keGudang.lokasi}
          </p>
        )}
      </div>
    </div>
  );
}

function TransferFotoGrid({
  fotoBukti,
  onOpenLightbox,
}: {
  fotoBukti?: string[];
  onOpenLightbox: (index: number) => void;
}) {
  if (!fotoBukti || fotoBukti.length === 0) {
    return (
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          Foto Bukti
        </p>
        <div className="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <svg
            className="h-8 w-8 mx-auto text-gray-400 dark:text-gray-500 mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tidak ada foto bukti
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        Foto Bukti
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        {fotoBukti.length} foto terlampir
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {fotoBukti.map((url, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onOpenLightbox(index)}
            className="relative overflow-hidden rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 cursor-pointer hover:border-blue-500 transition-colors group aspect-square"
          >
            <Image
              src={url}
              alt={`Foto bukti ${index + 1}`}
              fill
              className="object-cover"
              loading="eager"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <svg
                className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function TransferRelatedTransactions({ transfer }: { transfer: Transfer }) {
  if (!transfer.masuk && !transfer.keluar) return null;

  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        Transaksi Terkait
      </p>
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="space-y-2">
          {transfer.keluar && (
            <div className="flex items-center space-x-2">
              <span className="text-red-600 dark:text-red-400">Keluar:</span>
              <span className="text-sm">
                {new Date(transfer.keluar.tanggal).toLocaleString("id-ID")} -{" "}
                {transfer.keluar.keterangan}
              </span>
            </div>
          )}
          {transfer.masuk && (
            <div className="flex items-center space-x-2">
              <span className="text-green-600 dark:text-green-400">Masuk:</span>
              <span className="text-sm">
                {new Date(transfer.masuk.tanggal).toLocaleString("id-ID")} -{" "}
                {transfer.masuk.keterangan}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
