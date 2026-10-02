"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FiPackage,
  FiMapPin,
  FiCheck,
  FiAlertTriangle,
  FiBarChart2,
} from "react-icons/fi";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";
import {
  periodeSekarang,
  TAMPILAN_STATUS_SO,
  type KepatuhanGudang,
  type LaporanKepatuhanSo,
} from "./opname/jadwal/jadwalSoTypes";
import {
  LEGENDA_STATUS_SO,
  labelStatusSoGudang,
  statusSoPerGudang,
} from "./opname/jadwal/statusSoGudang";
import { OpnameItemsTable } from "./opname/OpnameItemsTable";
import { OpnameSummaryCards } from "./opname/OpnameSummaryCards";
import {
  useOpnameCalculation,
  type OpnameCalculationItem,
} from "./opname/useOpnameCalculation";
import { useSubmitOpname } from "./opname/useSubmitOpname";

interface StockOpnameRecorderProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

interface Gudang {
  id: string;
  kode: string;
  nama: string;
}

const SUCCESS_MESSAGE_DELAY_MS = 1500;
const REDIRECT_DELAY_MS = 2000;

type ItemPatchMap = Record<string, Partial<OpnameCalculationItem>>;

export function StockOpnameRecorder({
  onClose,
  onSuccess,
}: StockOpnameRecorderProps) {
  const router = useRouter();
  const [gudangId, setGudangId] = useState("");
  const [editsByBarang, setEditsByBarang] = useState<ItemPatchMap>({});
  const [dihitungIds, setDihitungIds] = useState<ReadonlySet<string>>(new Set());
  const [isHanyaBelumSo, setIsHanyaBelumSo] = useState(false);
  const [success, setSuccess] = useState("");
  const [recordingError, setRecordingError] = useState("");

  const { data: gudangData, error: gudangError } = useApi<{
    gudangs?: Gudang[];
  }>("/api/inventory/gudang?view=all");
  const gudangs = gudangData?.gudangs ?? [];
  const { data: laporanSo, refetch: refetchLaporanSo } =
    useApi<LaporanKepatuhanSo>(
      `/api/inventory/opname/kepatuhan?periode=${periodeSekarang()}`,
    );
  const statusSo = useMemo(() => statusSoPerGudang(laporanSo), [laporanSo]);

  const calculation = useOpnameCalculation(gudangId);
  const submitOpname = useSubmitOpname();

  const items = useMemo(
    () =>
      calculation.items.map((base) => ({
        ...base,
        ...(editsByBarang[base.barangId] ?? {}),
      })),
    [calculation.items, editsByBarang],
  );

  const selectedGudang = gudangs.find((g) => g.id === gudangId);
  const itemsToRecord = useMemo(
    () => items.filter((item) => dihitungIds.has(item.barangId)),
    [items, dihitungIds],
  );
  const visibleItems = useMemo(
    () => (isHanyaBelumSo ? items.filter((item) => !item.soBulanIni) : items),
    [items, isHanyaBelumSo],
  );
  const itemsWithDiscrepancyCount = useMemo(
    () => items.filter((i) => i.stokFisik !== i.stokSistem).length,
    [items],
  );

  const displayError =
    recordingError ||
    submitOpname.error ||
    calculation.error ||
    (gudangError ? "Gagal memuat data gudang" : "");

  const isSubmitDisabled =
    submitOpname.isSubmitting || itemsToRecord.length === 0;

  const handleGudangChange = (nextGudangId: string) => {
    setGudangId(nextGudangId);
    setEditsByBarang({});
    setDihitungIds(new Set());
    setRecordingError("");
    setSuccess("");
  };

  const handleToggleDihitung = (barangIds: string[], isDihitung: boolean) => {
    setDihitungIds((prev) => {
      const next = new Set(prev);
      for (const barangId of barangIds) {
        if (isDihitung) next.add(barangId);
        else next.delete(barangId);
      }
      return next;
    });
  };

  const handleItemChange = (
    barangId: string,
    patch: Partial<OpnameCalculationItem>,
  ) => {
    setEditsByBarang((prev) => ({
      ...prev,
      [barangId]: { ...(prev[barangId] ?? {}), ...patch },
    }));
    // Mengubah angka berarti barang ini sudah dihitung.
    handleToggleDihitung([barangId], true);
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuccess("");
    setRecordingError("");

    if (!gudangId) {
      setRecordingError("Pilih gudang terlebih dahulu");
      return;
    }

    if (itemsToRecord.length === 0) {
      setRecordingError("Centang barang yang sudah dihitung terlebih dahulu");
      return;
    }

    try {
      // Hanya barang yang ditandai sudah dihitung; yang cocok tersimpan dengan
      // selisih 0 sebagai bukti SO (tanpa mutasi stok).
      const result = await submitOpname.submit({ gudangId, items: itemsToRecord });

      setSuccess(
        `Stock opname berhasil dicatat untuk ${result.totalItems} item`,
      );
      setEditsByBarang({});
      setDihitungIds(new Set());
      setGudangId("");
      void refetchLaporanSo();

      if (onSuccess) {
        setTimeout(onSuccess, SUCCESS_MESSAGE_DELAY_MS);
      } else {
        setTimeout(
          () => router.push("/admin/inventory/opname/reports"),
          REDIRECT_DELAY_MS,
        );
      }
    } catch {
      // error sudah disimpan di submitOpname.error oleh hook
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <ErrorBanner message={displayError} />
        <SuccessBanner message={success} />

        <GudangSelector
          gudangs={gudangs}
          gudangId={gudangId}
          onChange={handleGudangChange}
          disabled={submitOpname.isSubmitting}
          selectedGudangNama={selectedGudang?.nama}
          statusSo={statusSo}
        />

        {calculation.summary && (
          <OpnameSummaryCards
            gudangNama={selectedGudang?.nama}
            summary={calculation.summary}
          />
        )}

        {calculation.isLoading && <LoadingIndicator />}

        {!calculation.isLoading && gudangId && items.length > 0 && (
          <OpnameItemsTable
            items={visibleItems}
            totalItems={items.length}
            dihitungIds={dihitungIds}
            dihitungCount={itemsToRecord.length}
            soBulanIniCount={items.filter((item) => item.soBulanIni).length}
            isHanyaBelumSo={isHanyaBelumSo}
            onHanyaBelumSoChange={setIsHanyaBelumSo}
            onToggleDihitung={handleToggleDihitung}
            itemsWithDiscrepancyCount={itemsWithDiscrepancyCount}
            gudangNama={selectedGudang?.nama}
            isSubmitting={submitOpname.isSubmitting}
            onItemChange={handleItemChange}
          />
        )}

        {!calculation.isLoading && gudangId && items.length === 0 && (
          <EmptyState />
        )}

        {gudangId && !calculation.isLoading && items.length > 0 && (
          <ActionButtons
            isSubmitting={submitOpname.isSubmitting}
            isDisabled={isSubmitDisabled}
            recordableCount={itemsToRecord.length}
            onClose={onClose}
          />
        )}
      </form>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-800 dark:text-red-400 flex items-start">
      <FiAlertTriangle className="mt-0.5 mr-2 shrink-0" />
      <div>{message}</div>
    </div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-green-800 dark:text-green-400 flex items-center">
      <FiCheck className="mr-2 shrink-0" />
      <div>{message}</div>
    </div>
  );
}

interface GudangSelectorProps {
  gudangs: Gudang[];
  gudangId: string;
  onChange: (value: string) => void;
  disabled: boolean;
  selectedGudangNama: string | undefined;
  /** Status SO bulan ini per gudang (kosong bila laporan belum termuat). */
  statusSo: Map<string, KepatuhanGudang>;
}

function GudangSelector({
  gudangs,
  gudangId,
  onChange,
  disabled,
  selectedGudangNama,
  statusSo,
}: GudangSelectorProps) {
  const statusTerpilih = statusSo.get(gudangId);
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="mb-4">
        <label
          htmlFor="gudangId"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          <FiMapPin className="inline mr-2" />
          Pilih Gudang untuk Stock Opname *
        </label>
        <select
          id="gudangId"
          value={gudangId}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          disabled={disabled}
        >
          <option value="">-- Pilih Gudang --</option>
          {gudangs.map((g) => {
            const statusGudang = statusSo.get(g.id);
            return (
              <option key={g.id} value={g.id}>
                {g.kode} - {g.nama}
                {statusGudang ? ` — ${labelStatusSoGudang(statusGudang)}` : ""}
              </option>
            );
          })}
        </select>
        {statusSo.size > 0 && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Status SO bulan ini: {LEGENDA_STATUS_SO}
          </p>
        )}
      </div>

      {selectedGudangNama && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-300 flex items-center gap-2">
            <FiBarChart2 className="w-4 h-4" /> Input Stock Opname - Stok Fisik
            {statusTerpilih && (
              <span
                className={`ml-auto px-2 py-0.5 rounded-full text-xs ${TAMPILAN_STATUS_SO[statusTerpilih.status].kelas}`}
              >
                Bulan ini: {labelStatusSoGudang(statusTerpilih)}
              </span>
            )}
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
            Input hasil hitungan stok fisik dan kondisi aktual di{" "}
            {selectedGudangNama}
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
            Centang &quot;Dihitung&quot; untuk barang yang sudah dihitung (otomatis
            tercentang bila angkanya diubah). Barang yang cocok cukup dicentang dan
            tercatat dengan selisih 0. Hanya barang yang dicentang yang disimpan.
          </p>
        </div>
      )}
    </div>
  );
}

function LoadingIndicator() {
  return (
    <div className="text-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        Memuat data stok sistem...
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg shadow">
      <FiPackage className="mx-auto h-12 w-12 text-gray-400" />
      <p className="mt-2 text-gray-500 dark:text-gray-400">
        Tidak ada barang di gudang ini
      </p>
    </div>
  );
}

interface ActionButtonsProps {
  isSubmitting: boolean;
  isDisabled: boolean;
  recordableCount: number;
  onClose?: () => void;
}

function ActionButtons({
  isSubmitting,
  isDisabled,
  recordableCount,
  onClose,
}: ActionButtonsProps) {
  return (
    <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
      {onClose && (
        <Button
          variant="outline"
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Batal
        </Button>
      )}
      <Button type="submit" disabled={isDisabled}>
        {isSubmitting
          ? "Mencatat..."
          : `Catat Stock Opname (${recordableCount} item)`}
      </Button>
    </div>
  );
}
