"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import {
  ALASAN_BATAL_MAKS,
  TUJUAN_RENCANA_MAKS,
  type RencanaDto,
} from "@/modules/presurvei/client";

import {
  KELAS_INPUT,
  KELAS_KESALAHAN,
  KELAS_LABEL,
  KELAS_PERINGATAN,
} from "./kelasForm";
import {
  KUNCI_KESALAHAN_FORM,
  nilaiUbahDariRencana,
  periksaAlasanBatal,
  periksaFormUbahRencana,
  type NilaiFormUbahRencana,
} from "./rencanaFormState";
import { urlBatalRencana, urlRincianRencana } from "./rencanaQuery";
import { keTanggalLokal } from "./rentangTanggal";
import type { PengirimRencana } from "./useKirimRencana";

interface AksiFormProps {
  rencana: RencanaDto;
  /** Pengirim milik modal, supaya modal tahu kapan penutupnya ditahan. */
  pengirim: PengirimRencana;
  /** Kembali ke tampilan rincian tanpa menyimpan. */
  onKembali: () => void;
}

/** Tombol Kembali + kirim di kaki form aksi. */
function KakiForm({
  labelKirim,
  isMenyimpan,
  variantKirim,
  onKembali,
}: {
  labelKirim: string;
  isMenyimpan: boolean;
  variantKirim?: "destructive";
  onKembali: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button
        type="button"
        variant="outline"
        onClick={onKembali}
        disabled={isMenyimpan}
      >
        Kembali
      </Button>
      <Button type="submit" variant={variantKirim} loading={isMenyimpan}>
        {labelKirim}
      </Button>
    </div>
  );
}

/** Form jadwal ulang: tanggal, jam, dan tujuan. Hanya medan yang berubah dikirim. */
export function FormUbahRencana({
  rencana,
  pengirim,
  onKembali,
}: AksiFormProps) {
  const [hariIni] = useState(() => keTanggalLokal(new Date()));
  const [nilai, setNilai] = useState<NilaiFormUbahRencana>(() =>
    nilaiUbahDariRencana(rencana),
  );
  const [kesalahan, setKesalahan] = useState<
    Partial<Record<keyof NilaiFormUbahRencana | "_form", string>>
  >({});
  const { kirim, isMenyimpan, pesanServer, bersihkanPesanServer } = pengirim;

  const ubahMedan = (perubahan: Partial<NilaiFormUbahRencana>) => {
    setNilai((lama) => ({ ...lama, ...perubahan }));
    setKesalahan({});
    bersihkanPesanServer();
  };

  const kirimForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const hasil = periksaFormUbahRencana(nilai, rencana, hariIni);
    if (hasil.success === false) {
      setKesalahan(hasil.kesalahan);
      return;
    }
    void kirim({
      url: urlRincianRencana(rencana.id),
      method: "PATCH",
      muatan: hasil.muatan,
      pesanBerhasil: "Rencana diperbarui",
      pesanGagal: "Gagal memperbarui rencana",
    });
  };

  const pesanForm = kesalahan[KUNCI_KESALAHAN_FORM] ?? pesanServer;

  return (
    <form onSubmit={kirimForm} className="space-y-4">
      <div>
        <label className={KELAS_LABEL} htmlFor="ubah-rencana-tanggal">
          Tanggal *
        </label>
        <input
          id="ubah-rencana-tanggal"
          type="date"
          min={hariIni}
          value={nilai.tanggal}
          onChange={(event) => ubahMedan({ tanggal: event.target.value })}
          className={KELAS_INPUT}
        />
        {kesalahan.tanggal && (
          <p className={KELAS_KESALAHAN}>{kesalahan.tanggal}</p>
        )}
      </div>
      <div>
        <label className={KELAS_LABEL} htmlFor="ubah-rencana-jam">
          Jam (kosongkan bila kapan saja)
        </label>
        <input
          id="ubah-rencana-jam"
          type="time"
          value={nilai.jam}
          onChange={(event) => ubahMedan({ jam: event.target.value })}
          className={KELAS_INPUT}
        />
        {kesalahan.jam && <p className={KELAS_KESALAHAN}>{kesalahan.jam}</p>}
      </div>
      <div>
        <label className={KELAS_LABEL} htmlFor="ubah-rencana-tujuan">
          Tujuan *
        </label>
        <textarea
          id="ubah-rencana-tujuan"
          rows={3}
          maxLength={TUJUAN_RENCANA_MAKS}
          value={nilai.tujuan}
          onChange={(event) => ubahMedan({ tujuan: event.target.value })}
          className={KELAS_INPUT}
        />
        {kesalahan.tujuan && (
          <p className={KELAS_KESALAHAN}>{kesalahan.tujuan}</p>
        )}
      </div>
      {pesanForm && (
        <p role="alert" className={KELAS_PERINGATAN}>
          {pesanForm}
        </p>
      )}
      <KakiForm
        labelKirim="Simpan"
        isMenyimpan={isMenyimpan}
        onKembali={onKembali}
      />
    </form>
  );
}

/** Form pembatalan beralasan; rencana tidak dihapus, pembatalan tercatat. */
export function FormBatalRencana({
  rencana,
  pengirim,
  onKembali,
}: AksiFormProps) {
  const [alasan, setAlasan] = useState("");
  const [kesalahan, setKesalahan] = useState<string | null>(null);
  const { kirim, isMenyimpan, pesanServer, bersihkanPesanServer } = pengirim;

  const kirimForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const hasil = periksaAlasanBatal(alasan);
    if (hasil.success === false) {
      setKesalahan(hasil.kesalahan.alasan ?? null);
      return;
    }
    void kirim({
      url: urlBatalRencana(rencana.id),
      method: "POST",
      muatan: hasil.muatan,
      pesanBerhasil: "Rencana dibatalkan",
      pesanGagal: "Gagal membatalkan rencana",
    });
  };

  return (
    <form onSubmit={kirimForm} className="space-y-4">
      <div>
        <label className={KELAS_LABEL} htmlFor="batal-rencana-alasan">
          Alasan pembatalan *
        </label>
        <textarea
          id="batal-rencana-alasan"
          rows={3}
          maxLength={ALASAN_BATAL_MAKS}
          value={alasan}
          onChange={(event) => {
            setAlasan(event.target.value);
            setKesalahan(null);
            bersihkanPesanServer();
          }}
          className={KELAS_INPUT}
        />
        {kesalahan && <p className={KELAS_KESALAHAN}>{kesalahan}</p>}
      </div>
      {pesanServer && (
        <p role="alert" className={KELAS_PERINGATAN}>
          {pesanServer}
        </p>
      )}
      <KakiForm
        labelKirim="Batalkan rencana"
        variantKirim="destructive"
        isMenyimpan={isMenyimpan}
        onKembali={onKembali}
      />
    </form>
  );
}
