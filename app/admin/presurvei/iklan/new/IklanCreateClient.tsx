"use client";

import { useState } from "react";

import { IklanForm } from "../IklanForm";
import {
  NILAI_FORM_KOSONG,
  opsiSimpanUntukMode,
  type ModeFormIklan,
  type NilaiFormIklan,
} from "../iklanFormState";
import { useSimpanIklan } from "../useSimpanIklan";

const MODE_BUAT: ModeFormIklan = { jenis: "buat" };

/** Form kampanye kosong yang mengirim `POST` ke endpoint daftar iklan. */
export function IklanCreateClient() {
  const [nilai, setNilai] = useState<NilaiFormIklan>(NILAI_FORM_KOSONG);

  const { simpan, isMenyimpan } = useSimpanIklan(
    opsiSimpanUntukMode(MODE_BUAT),
  );

  const ubahNilai = (perubahan: Partial<NilaiFormIklan>) =>
    setNilai((lama) => ({ ...lama, ...perubahan }));

  return (
    <IklanForm
      nilai={nilai}
      onUbah={ubahNilai}
      onSimpan={simpan}
      isMenyimpan={isMenyimpan}
      mode={MODE_BUAT}
    />
  );
}
