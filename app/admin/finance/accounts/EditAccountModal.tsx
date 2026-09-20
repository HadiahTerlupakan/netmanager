"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { Account } from "@/types";

/**
 * Ubah akun kas/bank, terutama menautkannya ke akun COA.
 *
 * Tautan itu yang membuat jurnal otomatis bisa terbentuk: handler akuntansi
 * menurunkan sisi kredit dari `coaId` akun kas. Selama kosong, pengeluaran dan
 * pembayaran tidak pernah menghasilkan jurnal, sehingga Laporan Arus Kas
 * (Akuntansi → Laporan → Arus Kas) selalu nol.
 */
interface CoaOption {
  id: string;
  code: string;
  name: string;
  isPostable: boolean;
  isActive: boolean;
}

interface EditAccountModalProps {
  isOpen: boolean;
  account: Account | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditAccountModal({
  isOpen,
  account,
  onClose,
  onSuccess,
}: EditAccountModalProps) {
  const [coaId, setCoaId] = useState("");
  const [coaOptions, setCoaOptions] = useState<CoaOption[]>([]);
  const [coaError, setCoaError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Reset nilai form saat modal dibuka. Disetel lewat pembanding nilai
  // sebelumnya, bukan di dalam effect: setState sinkron di effect memicu render
  // beruntun (dilarang aturan react-hooks di repo ini).
  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setCoaId(account?.coaId ?? "");
      setError("");
      setCoaError("");
    }
  }

  useEffect(() => {
    if (!isOpen) return;

    const loadCoa = async () => {
      try {
        const res = await fetch(
          "/api/admin/accounting/coa?type=ASSET&isActive=true",
        );
        if (!res.ok) {
          throw new Error(
            res.status === 403
              ? "Anda tidak punya akses daftar COA (butuh permission accounting:read)"
              : "Gagal memuat daftar COA",
          );
        }
        const json = await res.json();
        const items: CoaOption[] = json.data ?? [];
        setCoaOptions(items.filter((item) => item.isPostable));
      } catch (err) {
        setCoaError(err instanceof Error ? err.message : "Gagal memuat COA");
      }
    };

    void loadCoa();
  }, [isOpen]);

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!account) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/finance/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coaId: coaId || null }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal memperbarui akun");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Tautkan COA — ${account?.name ?? ""}`}
      description="Hubungkan akun kas/bank ini ke akun COA supaya transaksinya masuk jurnal dan Laporan Arus Kas terisi."
      size="md"
    >
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm border border-red-100 dark:border-red-900/30">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Akun COA Pasangan
            </label>
            <select
              value={coaId}
              onChange={(e) => setCoaId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            >
              <option value="">Belum ditautkan</option>
              {coaOptions.map((coa) => (
                <option key={coa.id} value={coa.id}>
                  {coa.code} — {coa.name}
                </option>
              ))}
            </select>
            {coaError ? (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                {coaError}
              </p>
            ) : (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Hanya akun aset yang bisa diposting yang ditampilkan. Untuk
                rekening bank biasanya <span className="font-mono">1-120</span>,
                untuk kas tunai <span className="font-mono">1-110</span>.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" loading={loading}>
              Simpan
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
