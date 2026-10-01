"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import {
  ALAMAT_RENCANA_MAKS,
  KEGIATAN_JENIS_CONFIG,
  RENCANA_JENIS,
  TUJUAN_RENCANA_MAKS,
  type RencanaJenis,
} from "@/modules/presurvei/client";

import { penutupModalDitahanSaatMenyimpan } from "../penutupModal";
import {
  KELAS_INPUT,
  KELAS_KESALAHAN,
  KELAS_LABEL,
  KELAS_PERINGATAN,
} from "./kelasForm";
import {
  nilaiAwalPenugasan,
  periksaFormPenugasan,
  type KesalahanFormPenugasan,
  type NilaiFormPenugasan,
} from "./rencanaFormState";
import { URL_API_RENCANA } from "./rencanaQuery";
import { keTanggalLokal } from "./rentangTanggal";
import { useKirimRencana } from "./useKirimRencana";
import type { KeadaanSalesTersedia } from "./useSalesTersediaQuery";

interface PenugasanFormModalProps {
  salesTersedia: KeadaanSalesTersedia;
  onClose: () => void;
}

/** Teks opsi kosong pemilih sales menurut keadaan pengambilannya. */
function teksOpsiKosongSales(status: KeadaanSalesTersedia["status"]): string {
  return status === "memuat" ? "Memuat daftar sales…" : "Pilih sales";
}

/**
 * Modal menugaskan rencana kunjungan ke seorang sales. Sales yang ditawarkan
 * hanya yang berada di lingkup pemakai (`sales-tersedia`); server tetap
 * menolak di luar lingkup dengan 403.
 */
export function PenugasanFormModal({
  salesTersedia,
  onClose,
}: PenugasanFormModalProps) {
  // Dibekukan saat modal dibuka: `min` medan tanggal dan pemeriksaan form
  // harus memakai "hari ini" yang sama.
  const [hariIni] = useState(() => keTanggalLokal(new Date()));
  const [nilai, setNilai] = useState<NilaiFormPenugasan>(() =>
    nilaiAwalPenugasan(hariIni),
  );
  const [kesalahan, setKesalahan] = useState<KesalahanFormPenugasan>({});
  const { kirim, isMenyimpan, pesanServer, bersihkanPesanServer } =
    useKirimRencana(onClose);
  const tutup = penutupModalDitahanSaatMenyimpan(isMenyimpan, onClose);

  const ubahMedan = (perubahan: Partial<NilaiFormPenugasan>) => {
    setNilai((lama) => ({ ...lama, ...perubahan }));
    setKesalahan({});
    bersihkanPesanServer();
  };

  const kirimForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const hasil = periksaFormPenugasan(nilai, hariIni);
    if (hasil.success === false) {
      setKesalahan(hasil.kesalahan);
      return;
    }
    void kirim({
      url: URL_API_RENCANA,
      method: "POST",
      muatan: hasil.muatan,
      pesanBerhasil: "Penugasan terkirim ke sales",
      pesanGagal: "Gagal membuat penugasan",
    });
  };

  return (
    <Modal isOpen onClose={tutup} title="Buat Penugasan" size="lg">
      <form onSubmit={kirimForm} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={KELAS_LABEL} htmlFor="penugasan-sales">
              Sales *
            </label>
            {salesTersedia.status === "gagal" ? (
              <p role="alert" className={KELAS_PERINGATAN}>
                Daftar sales gagal dimuat. Muat ulang halaman untuk mencoba
                lagi.
              </p>
            ) : (
              <select
                id="penugasan-sales"
                value={nilai.salesId}
                onChange={(event) => ubahMedan({ salesId: event.target.value })}
                disabled={salesTersedia.status !== "siap"}
                className={`${KELAS_INPUT} cursor-pointer`}
              >
                <option value="">
                  {teksOpsiKosongSales(salesTersedia.status)}
                </option>
                {salesTersedia.daftar.map((sales) => (
                  <option key={sales.id} value={sales.id}>
                    {sales.nama}
                  </option>
                ))}
              </select>
            )}
            {kesalahan.salesId && (
              <p className={KELAS_KESALAHAN}>{kesalahan.salesId}</p>
            )}
          </div>

          <div>
            <label className={KELAS_LABEL} htmlFor="penugasan-tanggal">
              Tanggal *
            </label>
            <input
              id="penugasan-tanggal"
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
            <label className={KELAS_LABEL} htmlFor="penugasan-jam">
              Jam (opsional)
            </label>
            <input
              id="penugasan-jam"
              type="time"
              value={nilai.jam}
              onChange={(event) => ubahMedan({ jam: event.target.value })}
              className={KELAS_INPUT}
            />
            {kesalahan.jam && (
              <p className={KELAS_KESALAHAN}>{kesalahan.jam}</p>
            )}
          </div>
        </div>

        <div>
          <label className={KELAS_LABEL} htmlFor="penugasan-jenis">
            Jenis *
          </label>
          <select
            id="penugasan-jenis"
            value={nilai.jenis}
            onChange={(event) =>
              ubahMedan({ jenis: event.target.value as RencanaJenis })
            }
            className={`${KELAS_INPUT} cursor-pointer`}
          >
            {RENCANA_JENIS.map((jenis) => (
              <option key={jenis} value={jenis}>
                {KEGIATAN_JENIS_CONFIG[jenis].label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={KELAS_LABEL} htmlFor="penugasan-tujuan">
            Tujuan *
          </label>
          <textarea
            id="penugasan-tujuan"
            rows={3}
            maxLength={TUJUAN_RENCANA_MAKS}
            value={nilai.tujuan}
            onChange={(event) => ubahMedan({ tujuan: event.target.value })}
            placeholder="Mis. follow-up penawaran paket 50 Mbps"
            className={KELAS_INPUT}
          />
          {kesalahan.tujuan && (
            <p className={KELAS_KESALAHAN}>{kesalahan.tujuan}</p>
          )}
        </div>

        <div>
          <label className={KELAS_LABEL} htmlFor="penugasan-alamat">
            Alamat
          </label>
          <input
            id="penugasan-alamat"
            type="text"
            maxLength={ALAMAT_RENCANA_MAKS}
            value={nilai.alamat}
            onChange={(event) => ubahMedan({ alamat: event.target.value })}
            placeholder="Opsional"
            className={KELAS_INPUT}
          />
          {kesalahan.alamat && (
            <p className={KELAS_KESALAHAN}>{kesalahan.alamat}</p>
          )}
        </div>

        {pesanServer && (
          <p role="alert" className={KELAS_PERINGATAN}>
            {pesanServer}
          </p>
        )}

        <ModalFooter className="-mx-5 -mb-5 mt-6 sm:-mx-6 sm:-mb-6">
          <Button
            type="button"
            variant="outline"
            onClick={tutup}
            disabled={isMenyimpan}
          >
            Batal
          </Button>
          <Button
            type="submit"
            loading={isMenyimpan}
            disabled={salesTersedia.status !== "siap"}
          >
            Tugaskan
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
