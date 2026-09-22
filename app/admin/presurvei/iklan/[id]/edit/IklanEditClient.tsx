"use client";

import { useState } from "react";

import { Skeleton } from "@/components/ui/LoadingSkeleton";
import { useApi } from "@/lib/hooks/useApi";
import type { IklanDetailDto } from "@/modules/presurvei/client";

import { IklanForm } from "../../IklanForm";
import { keNilaiForm, type NilaiFormIklan } from "../../iklanFormState";
import { useSimpanIklan } from "../../useSimpanIklan";

const KELAS_PESAN = "py-12 text-center text-gray-500 dark:text-gray-400";

interface FormUbahIklanProps {
  iklanId: string;
  nilaiAwal: NilaiFormIklan;
}

/**
 * Form yang sudah terisi, dipisah supaya `useState` bisa diberi nilai awal
 * lewat initializer-nya. Komponen ini baru dipasang setelah detailnya ada,
 * jadi tidak perlu menyalin data masuk lewat efek — yang akan menimpa
 * suntingan pemakai setiap kali query menyegarkan diri.
 */
function FormUbahIklan({ iklanId, nilaiAwal }: FormUbahIklanProps) {
  const [nilai, setNilai] = useState<NilaiFormIklan>(nilaiAwal);

  const { simpan, isMenyimpan } = useSimpanIklan({
    url: `/api/admin/presurvei/iklan/${iklanId}`,
    method: "PATCH",
    pesanSukses: "Kampanye berhasil diperbarui",
    pesanGagal: "Gagal memperbarui kampanye",
  });

  const ubahNilai = (perubahan: Partial<NilaiFormIklan>) =>
    setNilai((lama) => ({ ...lama, ...perubahan }));

  return (
    <IklanForm
      nilai={nilai}
      onUbah={ubahNilai}
      onSimpan={simpan}
      isMenyimpan={isMenyimpan}
      isModeUbah
    />
  );
}

/** Memuat detail kampanye, lalu merender form dalam mode ubah. */
export function IklanEditClient({ iklanId }: { iklanId: string }) {
  const {
    data: iklan,
    error,
    isLoading,
  } = useApi<IklanDetailDto>(`/api/admin/presurvei/iklan/${iklanId}`);

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Gagal memuat dibedakan dari tidak ditemukan: menyamakan keduanya membuat
  // gangguan jaringan atau 403 tampil sebagai kampanye yang seolah tidak ada.
  if (error) {
    return (
      <p className={KELAS_PESAN}>Gagal memuat kampanye: {error.message}</p>
    );
  }

  if (!iklan) {
    return <p className={KELAS_PESAN}>Kampanye tidak ditemukan</p>;
  }

  return <FormUbahIklan iklanId={iklanId} nilaiAwal={keNilaiForm(iklan)} />;
}
