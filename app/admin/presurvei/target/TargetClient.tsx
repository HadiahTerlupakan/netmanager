"use client";

import { useMemo, useState } from "react";
import { HiOutlinePlus } from "react-icons/hi2";

import { Button } from "@/components/ui/Button";
import { usePermission } from "@/hooks/use-permission";
import { PERMISSIONS } from "@/lib/permissions";

import { useDaftarSalesPresurvei } from "../useDaftarSalesPresurvei";
import { keBarisTarget, type BarisTarget } from "./barisTarget";
import {
  namaBulan,
  periodeSekarang,
  pilihanBulan,
  pilihanTahun,
} from "./periodeQuery";
import { TargetFormModal } from "./TargetFormModal";
import { TargetTable } from "./TargetTable";
import { useTargetPeriode } from "./useTargetPeriode";

const KELAS_SELECT =
  "cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

/** Modal yang sedang terbuka: tertutup, menetapkan baru, atau mengubah baris. */
type KeadaanModal =
  | { jenis: "tertutup" }
  | { jenis: "terbuka"; targetDiubah: BarisTarget | null };

const MODAL_TERTUTUP: KeadaanModal = { jenis: "tertutup" };

/** Layar target sales: pemilih periode, tabel target, dan modal penetapan. */
export function TargetClient() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission(
    PERMISSIONS.MARKETING.PRESURVEI_TARGET.CREATE,
  );

  const { periode, ubahPeriode, daftarTarget, isLoading, isError } =
    useTargetPeriode();
  const daftarSales = useDaftarSalesPresurvei();
  const [modal, setModal] = useState<KeadaanModal>(MODAL_TERTUTUP);

  const baris = useMemo(
    () => keBarisTarget(daftarTarget, daftarSales),
    [daftarTarget, daftarSales],
  );
  const tahunTersedia = useMemo(
    () => pilihanTahun(periodeSekarang().tahun),
    [],
  );

  const tutupModal = () => setModal(MODAL_TERTUTUP);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Target Sales
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Target kunjungan, prospek, dan konversi setiap sales per bulan
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => setModal({ jenis: "terbuka", targetDiubah: null })}
          >
            <HiOutlinePlus className="h-4 w-4" />
            Tetapkan target
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="target-periode-bulan">
          Bulan
        </label>
        <select
          id="target-periode-bulan"
          value={periode.bulan}
          onChange={(event) =>
            ubahPeriode({ bulan: Number(event.target.value) })
          }
          className={KELAS_SELECT}
        >
          {pilihanBulan().map((bulan) => (
            <option key={bulan} value={bulan}>
              {namaBulan(bulan)}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="target-periode-tahun">
          Tahun
        </label>
        <select
          id="target-periode-tahun"
          value={periode.tahun}
          onChange={(event) =>
            ubahPeriode({ tahun: Number(event.target.value) })
          }
          className={KELAS_SELECT}
        >
          {tahunTersedia.map((tahun) => (
            <option key={tahun} value={tahun}>
              {tahun}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <TargetTable
          baris={baris}
          isLoading={isLoading}
          isError={isError}
          onUbah={
            canCreate
              ? (item) => setModal({ jenis: "terbuka", targetDiubah: item })
              : null
          }
        />
      </div>

      {/* Dirender hanya saat terbuka, sehingga isian form lahir ulang dari
          baris yang dipilih setiap kali modal dibuka. */}
      {modal.jenis === "terbuka" && (
        <TargetFormModal
          periode={periode}
          barisPeriode={baris}
          targetDiubah={modal.targetDiubah}
          onClose={tutupModal}
        />
      )}
    </div>
  );
}
