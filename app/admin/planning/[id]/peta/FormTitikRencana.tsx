"use client";

import { useState } from "react";
import { HiOutlineLink } from "react-icons/hi2";

import { Button } from "@/components/ui/Button";
import {
  RASIO_SPLITTER_ODC,
  RASIO_SPLITTER_ODP,
  type BuatTitikRencanaInput,
  type TitikRencanaDTO,
} from "@/modules/planning/client";

/** Koordinat sebagai teks, supaya pengetikan sebagian tidak dibulatkan paksa. */
export interface KoordinatTeks {
  latitude: string;
  longitude: string;
}

interface FormTitikRencanaProps {
  /** Koordinat dikendalikan induk: klik di peta dan pengetikan mengisi medan yang sama. */
  koordinat: KoordinatTeks;
  onKoordinatChange: (koordinat: KoordinatTeks) => void;
  sedangMenyimpan: boolean;
  dapatDiubah: boolean;
  /**
   * Titik yang sedang dikoreksi; `null` berarti form membuat titik baru.
   *
   * Induk WAJIB memberi `key` yang berubah bersama titik ini (mis.
   * `titikDiubah?.nodeId ?? "baru"`) supaya form terpasang ulang dengan
   * nilai awal yang benar — tanpa itu isinya tertinggal dari titik sebelumnya.
   */
  titikDiubah?: TitikRencanaDTO | null;
  /** Membatalkan koreksi; hanya dipakai saat `titikDiubah` terisi. */
  onBatalUbah?: () => void;
  /** Mengembalikan true bila titik tersimpan, supaya form bisa dikosongkan. */
  onSimpan: (input: BuatTitikRencanaInput) => Promise<boolean>;
}

type JenisTitik = "odp" | "odc";

const JENIS_TITIK: Array<{ nilai: JenisTitik; label: string }> = [
  { nilai: "odp", label: "ODP" },
  { nilai: "odc", label: "ODC" },
];

const BATAS_LATITUDE = 90;
const BATAS_LONGITUDE = 180;

const KELAS_MEDAN =
  "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500";
const KELAS_LABEL =
  "block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1";

/**
 * Jalan keluar yang selalu tersedia saat tautan tidak bisa diurai. Koordinat
 * ODP yang salah lebih berbahaya daripada koordinat yang kosong: seluruh
 * perhitungan kabel ikut salah tanpa ada yang menyadarinya, jadi form ini
 * tidak pernah menebak isi tautan yang gagal.
 */
const JALAN_KELUAR_TAUTAN =
  "Buka tautan itu di browser, lalu salin angka koordinatnya ke kolom Latitude dan Longitude.";

/** Rasio yang sah berbeda per jenis titik; daftarnya milik validator modul planning. */
function rasioUntuk(jenis: JenisTitik): readonly string[] {
  return jenis === "odc" ? RASIO_SPLITTER_ODC : RASIO_SPLITTER_ODP;
}

/** Jenis titik yang sah dari baris topologi; nilai lain dianggap ODP. */
function jenisAwal(titik: TitikRencanaDTO | null | undefined): JenisTitik {
  return titik?.type === "odc" ? "odc" : "odp";
}

/** Angka koordinat yang sah, atau null bila teksnya bukan angka dalam rentang. */
function bacaKoordinat(teks: string, batas: number): number | null {
  const bersih = teks.trim();
  if (!bersih) return null;
  const angka = Number(bersih);
  if (!Number.isFinite(angka) || angka < -batas || angka > batas) return null;
  return angka;
}

/**
 * Form satu titik rencana dengan tiga cara mengisi koordinat: klik di peta
 * (induk yang mengisi `koordinat`), mengetik latitude/longitude, dan menempel
 * tautan Google Maps.
 *
 * Dipakai untuk membuat titik baru maupun mengoreksi titik yang sudah ada
 * (`titikDiubah`). Satu form untuk keduanya karena aturannya sama persis —
 * terutama rasio splitter yang wajib dan tanpa nilai bawaan, yang justru
 * paling sering jadi alasan sebuah titik perlu dikoreksi.
 */
export function FormTitikRencana({
  koordinat,
  onKoordinatChange,
  sedangMenyimpan,
  dapatDiubah,
  titikDiubah = null,
  onBatalUbah,
  onSimpan,
}: FormTitikRencanaProps) {
  const sedangMengubah = titikDiubah !== null;
  const [jenis, setJenis] = useState<JenisTitik>(jenisAwal(titikDiubah));
  const [nama, setNama] = useState(titikDiubah?.name ?? "");
  // Sengaja kosong saat membuat titik: di dokumen anggaran, rasio yang tidak
  // pernah disentuh perencana akan diam-diam menjadi jumlah splitter yang
  // dibeli. Saat mengoreksi, rasio yang ada ditampilkan apa adanya.
  const [splitter, setSplitter] = useState(titikDiubah?.splitter ?? "");
  const [catatan, setCatatan] = useState(titikDiubah?.notes ?? "");
  const [tautan, setTautan] = useState("");
  const [pesanTautan, setPesanTautan] = useState<string | null>(null);
  const [sedangMenguraiTautan, setSedangMenguraiTautan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const gantiJenis = (jenisBaru: JenisTitik) => {
    setJenis(jenisBaru);
    // Rasio yang tidak sah untuk jenis baru dikosongkan, bukan dipertahankan
    // diam-diam: server akan menolaknya dan perencana tidak tahu sebabnya.
    if (!rasioUntuk(jenisBaru).includes(splitter)) {
      setSplitter("");
    }
  };

  const uraikanTautan = async () => {
    const bersih = tautan.trim();
    if (!bersih) {
      setPesanTautan("Tempel dulu tautan Google Maps-nya.");
      return;
    }

    setSedangMenguraiTautan(true);
    setPesanTautan(null);
    try {
      const respons = await fetch("/api/planning/tautan-peta/uraikan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tautan: bersih }),
      });
      const badan = await respons.json().catch((): null => null);
      const hasil = badan?.data as
        | {
            status?: string;
            latitude?: number;
            longitude?: number;
            alasan?: string;
          }
        | undefined;

      if (!respons.ok) {
        setPesanTautan(
          `${badan?.error ?? badan?.message ?? "Tautan tidak dapat diurai."} ${JALAN_KELUAR_TAUTAN}`,
        );
        return;
      }

      if (
        hasil?.status !== "berhasil" ||
        typeof hasil.latitude !== "number" ||
        typeof hasil.longitude !== "number"
      ) {
        setPesanTautan(
          `${hasil?.alasan ?? "Tautan tidak memuat koordinat."} ${JALAN_KELUAR_TAUTAN}`,
        );
        return;
      }

      onKoordinatChange({
        latitude: String(hasil.latitude),
        longitude: String(hasil.longitude),
      });
      setPesanTautan(null);
    } catch {
      setPesanTautan(`Tautan tidak dapat dibuka. ${JALAN_KELUAR_TAUTAN}`);
    } finally {
      setSedangMenguraiTautan(false);
    }
  };

  const simpan = async () => {
    if (!nama.trim()) {
      setGalat("Nama titik wajib diisi");
      return;
    }
    const latitude = bacaKoordinat(koordinat.latitude, BATAS_LATITUDE);
    const longitude = bacaKoordinat(koordinat.longitude, BATAS_LONGITUDE);
    if (latitude === null || longitude === null) {
      setGalat(
        "Koordinat belum sah. Klik di peta, ketik latitude/longitude, atau tempel tautan Google Maps.",
      );
      return;
    }
    if (!splitter) {
      setGalat("Rasio splitter wajib dipilih");
      return;
    }

    setGalat(null);
    const tersimpan = await onSimpan({
      type: jenis,
      name: nama.trim(),
      latitude,
      longitude,
      splitter,
      notes: catatan.trim() || null,
    });

    // Saat mengoreksi, induk menutup mode ubah dan form terpasang ulang lewat
    // `key`, jadi tidak ada yang perlu dikosongkan di sini.
    if (tersimpan && !sedangMengubah) {
      setNama("");
      setSplitter("");
      setCatatan("");
      setTautan("");
      setPesanTautan(null);
      onKoordinatChange({ latitude: "", longitude: "" });
    }
  };

  if (!dapatDiubah) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Titik rencana
        </h3>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Peta rencana terkunci pada status ini. Hanya rencana berstatus Backlog
          atau Ditolak yang masih bisa diubah.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
        {sedangMengubah ? "Ubah titik rencana" : "Tambah titik rencana"}
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={KELAS_LABEL} htmlFor="titik-jenis">
            Jenis titik
          </label>
          <select
            id="titik-jenis"
            className={KELAS_MEDAN}
            value={jenis}
            disabled={sedangMengubah}
            onChange={(e) => gantiJenis(e.target.value as JenisTitik)}
          >
            {JENIS_TITIK.map((pilihan) => (
              <option key={pilihan.nilai} value={pilihan.nilai}>
                {pilihan.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={KELAS_LABEL} htmlFor="titik-splitter">
            Rasio splitter <span className="text-red-500">*</span>
          </label>
          <select
            id="titik-splitter"
            className={KELAS_MEDAN}
            value={splitter}
            onChange={(e) => setSplitter(e.target.value)}
          >
            <option value="">Pilih rasio…</option>
            {rasioUntuk(jenis).map((rasio) => (
              <option key={rasio} value={rasio}>
                {rasio}
              </option>
            ))}
          </select>
        </div>
      </div>

      {sedangMengubah && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Jenis titik tidak bisa diganti. Bila jenisnya salah, hapus titik ini
          (setelah jalurnya dihapus) lalu buat titik baru.
        </p>
      )}

      <div>
        <label className={KELAS_LABEL} htmlFor="titik-nama">
          Nama titik <span className="text-red-500">*</span>
        </label>
        <input
          id="titik-nama"
          className={KELAS_MEDAN}
          value={nama}
          placeholder="ODP-CPN-01"
          onChange={(e) => setNama(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={KELAS_LABEL} htmlFor="titik-latitude">
            Latitude
          </label>
          <input
            id="titik-latitude"
            className={KELAS_MEDAN}
            value={koordinat.latitude}
            placeholder="-6.208800"
            onChange={(e) =>
              onKoordinatChange({ ...koordinat, latitude: e.target.value })
            }
          />
        </div>
        <div>
          <label className={KELAS_LABEL} htmlFor="titik-longitude">
            Longitude
          </label>
          <input
            id="titik-longitude"
            className={KELAS_MEDAN}
            value={koordinat.longitude}
            placeholder="106.845600"
            onChange={(e) =>
              onKoordinatChange({ ...koordinat, longitude: e.target.value })
            }
          />
        </div>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Klik di peta untuk mengisi koordinat, atau ketik sendiri — penanda di
        peta ikut berpindah.
      </p>

      <div>
        <label className={KELAS_LABEL} htmlFor="titik-tautan">
          Tautan Google Maps
        </label>
        <div className="flex gap-2">
          <input
            id="titik-tautan"
            className={KELAS_MEDAN}
            value={tautan}
            placeholder="https://maps.app.goo.gl/…"
            onChange={(e) => {
              setTautan(e.target.value);
              setPesanTautan(null);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            loading={sedangMenguraiTautan}
            disabled={sedangMenguraiTautan}
            onClick={uraikanTautan}
          >
            <HiOutlineLink className="w-4 h-4" />
            Ambil koordinat
          </Button>
        </div>
        {pesanTautan && (
          <p
            role="alert"
            className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
          >
            {pesanTautan}
          </p>
        )}
      </div>

      <div>
        <label className={KELAS_LABEL} htmlFor="titik-catatan">
          Catatan
        </label>
        <textarea
          id="titik-catatan"
          rows={2}
          className={KELAS_MEDAN}
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
        />
      </div>

      {galat && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
        >
          {galat}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          loading={sedangMenyimpan}
          disabled={sedangMenyimpan}
          onClick={simpan}
        >
          {sedangMengubah ? "Simpan perubahan" : "Simpan titik"}
        </Button>
        {sedangMengubah && (
          <Button size="sm" variant="outline" onClick={onBatalUbah}>
            Batal
          </Button>
        )}
      </div>
    </div>
  );
}
