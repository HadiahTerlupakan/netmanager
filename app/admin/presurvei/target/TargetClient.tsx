"use client";

import { useMemo, useState } from "react";
import { HiOutlinePlus } from "react-icons/hi2";

import { Button } from "@/components/ui/Button";
import { usePermission } from "@/hooks/use-permission";
import { PERMISSIONS } from "@/lib/permissions";

import { PemilihPeriode } from "../PemilihPeriode";
import { useDaftarSalesPresurvei } from "../useDaftarSalesPresurvei";
import { keBarisTarget, type BarisTarget } from "./barisTarget";
import { TargetFormModal } from "./TargetFormModal";
import { TargetTable } from "./TargetTable";
import { useTargetPeriode } from "./useTargetPeriode";

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

      <PemilihPeriode periode={periode} onUbah={ubahPeriode} />

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
