"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  HiOutlinePencil,
  HiOutlineCheckCircle,
  HiOutlineXMark,
} from "react-icons/hi2";

interface TaxRateConfig {
  id: string;
  code: string;
  name: string;
  category: "PPN" | "PPH" | "BHP_USO" | "OTHER";
  rate: number;
  dueDay: number | null;
  dueMonth: number | null;
  isActive: boolean;
  description: string | null;
  sortOrder: number;
}

interface CardDef {
  /** Judul card di UI. */
  title: string;
  /** Subtitle pendek untuk konteks compliance. */
  subtitle: string;
  /** Daftar code TaxRateConfig yang ditampilkan dalam card ini.
   *  Modul lain tinggal panggil `getRateByCode(code)` dari salah satunya. */
  codes: string[];
  /** Apakah field jatuh tempo ditampilkan sebagai tanggal (1-31) atau bulan ke- (1-12). */
  dueMode: "day" | "month" | "none";
}

const CARDS: CardDef[] = [
  {
    title: "PPN",
    subtitle: "Pajak Pertambahan Nilai. Tarif standar Indonesia 11%.",
    codes: ["PPN"],
    dueMode: "day",
  },
  {
    title: "PPh 21",
    subtitle: "PPh atas penghasilan karyawan. Tarif progresif via TER.",
    codes: ["PPH21"],
    dueMode: "day",
  },
  {
    title: "PPh 23",
    subtitle: "PPh atas imbalan jasa & sewa selain tanah/bangunan.",
    codes: ["PPH23_JASA", "PPH23_SEWA"],
    dueMode: "day",
  },
  {
    title: "PPh 4(2)",
    subtitle: "PPh final atas sewa tanah/bangunan.",
    codes: ["PPH4_FINAL"],
    dueMode: "day",
  },
  {
    title: "BHP",
    subtitle: "Biaya Hak Penggunaan frekuensi/spektrum. Setor tahunan.",
    codes: ["BHP"],
    dueMode: "month",
  },
  {
    title: "USO",
    subtitle: "Universal Service Obligation. Setor tahunan.",
    codes: ["USO"],
    dueMode: "month",
  },
];

interface Props {
  canManage: boolean;
}

const TAX_RATE_CONFIGS_KEY = ["admin", "tax", "rate-configs"] as const;

async function fetchTaxRateConfigs(): Promise<TaxRateConfig[]> {
  const res = await fetch("/api/admin/tax/rate-configs");
  if (!res.ok) {
    throw new Error("Gagal memuat tarif pajak");
  }
  const json = await res.json();
  return json.data ?? [];
}

interface SaveTaxRatePayload {
  id: string;
  patch: Partial<Pick<TaxRateConfig, "rate" | "dueDay" | "dueMonth">>;
}

async function saveTaxRateConfig({
  id,
  patch,
}: SaveTaxRatePayload): Promise<void> {
  const res = await fetch(`/api/admin/tax/rate-configs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch((): null => null);
    throw new Error(err?.error ?? "Gagal menyimpan");
  }
}

export function TarifPajakFleksibelSection({ canManage }: Props) {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: TAX_RATE_CONFIGS_KEY,
    queryFn: fetchTaxRateConfigs,
  });

  const saveMutation = useMutation({
    mutationFn: saveTaxRateConfig,
    onSuccess: async () => {
      toast.success("Tarif disimpan");
      await queryClient.invalidateQueries({ queryKey: TAX_RATE_CONFIGS_KEY });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleSaveItem = async (
    id: string,
    patch: Partial<Pick<TaxRateConfig, "rate" | "dueDay" | "dueMonth">>,
  ): Promise<boolean> => {
    try {
      await saveMutation.mutateAsync({ id, patch });
      return true;
    } catch {
      return false;
    }
  };

  if (isLoading) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
        Memuat tarif pajak...
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
          Pengaturan Pajak per Jenis
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
          Tarif pajak yang dipakai modul lain (procurement, finance, payroll).
          Modul tinggal lookup berdasarkan kode (mis. <code>PPN</code>,{" "}
          <code>PPH23_JASA</code>) — ubah tarif di sini, semua modul ikut.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CARDS.map((card) => {
          const cardItems = card.codes
            .map((code) => items.find((i) => i.code === code))
            .filter((i): i is TaxRateConfig => i !== undefined);

          if (cardItems.length === 0) return null;

          return (
            <TaxRateCard
              key={card.title}
              card={card}
              items={cardItems}
              canManage={canManage}
              onSave={handleSaveItem}
            />
          );
        })}
      </div>
    </div>
  );
}

interface TaxRateCardProps {
  card: CardDef;
  items: TaxRateConfig[];
  canManage: boolean;
  onSave: (
    id: string,
    patch: Partial<Pick<TaxRateConfig, "rate" | "dueDay" | "dueMonth">>,
  ) => Promise<boolean>;
}

function TaxRateCard({ card, items, canManage, onSave }: TaxRateCardProps) {
  return (
    <div className="border border-gray-100 dark:border-gray-700 rounded-2xl p-5 bg-white dark:bg-gray-900 shadow-sm">
      <h3 className="text-base font-semibold text-gray-900 dark:text-white">
        {card.title}
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">
        {card.subtitle}
      </p>

      <div className="space-y-3">
        {items.map((item) => (
          <RateRow
            key={item.id}
            item={item}
            dueMode={card.dueMode}
            canManage={canManage}
            onSave={onSave}
            showItemName={items.length > 1}
          />
        ))}
      </div>
    </div>
  );
}

interface RateRowProps {
  item: TaxRateConfig;
  dueMode: "day" | "month" | "none";
  canManage: boolean;
  showItemName: boolean;
  onSave: (
    id: string,
    patch: Partial<Pick<TaxRateConfig, "rate" | "dueDay" | "dueMonth">>,
  ) => Promise<boolean>;
}

function RateRow({
  item,
  dueMode,
  canManage,
  showItemName,
  onSave,
}: RateRowProps) {
  const [editing, setEditing] = useState(false);
  const [rate, setRate] = useState(String(item.rate));
  const [dueValue, setDueValue] = useState(
    String(dueMode === "month" ? (item.dueMonth ?? "") : (item.dueDay ?? "")),
  );
  const [submitting, setSubmitting] = useState(false);

  const cancel = (): void => {
    setRate(String(item.rate));
    setDueValue(
      String(dueMode === "month" ? (item.dueMonth ?? "") : (item.dueDay ?? "")),
    );
    setEditing(false);
  };

  const save = async (): Promise<void> => {
    if (submitting) return;
    setSubmitting(true);

    const patch: Partial<Pick<TaxRateConfig, "rate" | "dueDay" | "dueMonth">> =
      {
        rate: Number(rate),
      };
    if (dueMode === "day") {
      patch.dueDay = dueValue ? Number(dueValue) : null;
    } else if (dueMode === "month") {
      patch.dueMonth = dueValue ? Number(dueValue) : null;
    }

    const ok = await onSave(item.id, patch);
    setSubmitting(false);
    if (ok) setEditing(false);
  };

  const dueLabel =
    dueMode === "month" ? "Jatuh tempo (bulan)" : "Jatuh tempo (tanggal)";
  const dueDisplay =
    dueMode === "month"
      ? item.dueMonth !== null
        ? `bulan ke-${item.dueMonth}`
        : "—"
      : item.dueDay !== null
        ? `tgl ${item.dueDay}`
        : "—";

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0 border-gray-100 dark:border-gray-800">
        <div className="min-w-0">
          {showItemName && (
            <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
              {item.name}
            </div>
          )}
          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300 mt-0.5">
            <span>
              Tarif:{" "}
              <span className="font-mono font-semibold text-gray-900 dark:text-white">
                {item.rate.toFixed(2)}%
              </span>
            </span>
            {dueMode !== "none" && <span className="text-gray-400">·</span>}
            {dueMode !== "none" && <span>{dueDisplay}</span>}
          </div>
          <div className="text-xs text-gray-400 mt-0.5 font-mono">
            kode: {item.code}
          </div>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg"
            aria-label={`Edit ${item.name}`}
          >
            <HiOutlinePencil className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="py-3 border-b last:border-b-0 border-gray-100 dark:border-gray-800">
      {showItemName && (
        <div className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-2">
          {item.name}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
            Tarif (%)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
          />
        </div>
        {dueMode !== "none" && (
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              {dueLabel}
            </label>
            <input
              type="number"
              min="1"
              max={dueMode === "month" ? 12 : 31}
              value={dueValue}
              onChange={(e) => setDueValue(e.target.value)}
              placeholder="kosongkan jika N/A"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        )}
      </div>
      <div className="flex justify-end gap-1 mt-2">
        <button
          type="button"
          onClick={cancel}
          disabled={submitting}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <HiOutlineXMark className="w-3.5 h-3.5" />
          Batal
        </button>
        <button
          type="button"
          onClick={save}
          disabled={submitting}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
        >
          <HiOutlineCheckCircle className="w-3.5 h-3.5" />
          {submitting ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </div>
  );
}
