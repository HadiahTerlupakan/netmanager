"use client";

import { useState } from "react";

import { IklanForm } from "../IklanForm";
import { NILAI_FORM_KOSONG, type NilaiFormIklan } from "../iklanFormState";
import { useSimpanIklan } from "../useSimpanIklan";

/** Form kampanye kosong yang mengirim `POST` ke endpoint daftar iklan. */
export function IklanCreateClient() {
  const [nilai, setNilai] = useState<NilaiFormIklan>(NILAI_FORM_KOSONG);

  const { simpan, isMenyimpan } = useSimpanIklan({
    url: "/api/admin/presurvei/iklan",
    method: "POST",
    pesanSukses: "Kampanye berhasil dibuat",
    pesanGagal: "Gagal membuat kampanye",
  });

  const ubahNilai = (perubahan: Partial<NilaiFormIklan>) =>
    setNilai((lama) => ({ ...lama, ...perubahan }));

  return (
    <IklanForm
      nilai={nilai}
      onUbah={ubahNilai}
      onSimpan={simpan}
      isMenyimpan={isMenyimpan}
      isModeUbah={false}
    />
  );
}
