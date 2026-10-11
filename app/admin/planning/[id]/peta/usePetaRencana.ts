"use client";

import { useCallback, useRef, useState } from "react";

import { useApi } from "@/lib/hooks/useApi";
import { useInvalidatePlanningRelated } from "@/lib/hooks/useInvalidate";
import { formatApiError } from "@/lib/utils/api-response-parser";
import type {
  BuatJalurRencanaInput,
  BuatTitikRencanaInput,
  JalurRencanaDTO,
  KebutuhanMaterialOsp,
  PetaPlanningDTO,
  TitikRencanaDTO,
} from "@/modules/planning/client";

/** Pesan yang ditampilkan di atas peta; `nada` menentukan warnanya. */
export interface PesanPeta {
  nada: "galat" | "info" | "sukses";
  teks: string;
}

interface HasilKirim {
  berhasil: boolean;
  status: number;
  badan: unknown;
}

const STATUS_TIDAK_DITEMUKAN = 404;
const STATUS_DILARANG = 403;

/** Kunci penjaga untuk permintaan yang hanya boleh berjalan satu per satu. */
const KUNCI_TERBITKAN_MATERIAL = "terbitkan-material";
const KUNCI_TERBITKAN_PETA = "terbitkan-peta";
const KUNCI_TAMBAH_TITIK = "tambah-titik";
const KUNCI_TAMBAH_JALUR = "tambah-jalur";

/** Kunci penjaga per titik, dipisah agar ubah dan unggah foto tidak saling memblokir. */
const kunciUbahTitik = (nodeId: string): string => `ubah-titik:${nodeId}`;
const kunciFotoTitik = (nodeId: string): string => `foto-titik:${nodeId}`;

/**
 * Penjelasan 403 pada penerbitan peta.
 *
 * Menerbitkan menuntut `planning:update` DAN `map:create`; yang kedua
 * dihitung di route dan ditolak penuh. Pesan API-nya menyebut nama izin
 * mentah, yang tidak memberi tahu perencana apa yang harus dia lakukan.
 */
const PESAN_TANPA_IZIN_TERBIT =
  "Akun Anda boleh merencanakan, tetapi tidak boleh menambah perangkat ke peta jaringan (izin map:create). Minta administrator menambahkan izin itu, atau minta rekan yang punya hak peta untuk menerbitkannya.";

/**
 * Pesan untuk 404 pada penghapusan: layar ini lebih tua dari datanya.
 *
 * Sengaja TIDAK mengklaim satu sebab. 404 timbul dari dua jalur yang tidak
 * bisa dibedakan dari sini: titik sudah terbit menjadi node jaringan, atau
 * titik sudah dihapus (termasuk oleh klik hapus kedua pemakai ini sendiri).
 * Versi sebelumnya menyatakan "sudah terbit menjadi node jaringan nyata" —
 * pernyataan palsu pada kasus yang justru paling sering. Syarat "jangan
 * menggemakan galat API" tidak mewajibkan menebak sebab tunggal.
 */
function pesanTidakAdaLagi(sebutan: string): PesanPeta {
  return {
    nada: "info",
    teks: `${sebutan} sudah tidak ada di rencana ini. Mungkin sudah diterbitkan menjadi node jaringan, atau sudah dihapus. Peta sudah disegarkan.`,
  };
}

/**
 * Penjaga permintaan yang sedang berjalan, per kunci.
 *
 * Kebenarannya disimpan di `ref` dan dibaca SEBELUM `await`. Penjaga berbasis
 * state tidak menutup apa pun: dua pemanggilan dalam satu tick memegang
 * closure yang sama, sama-sama membaca `false`, dan sama-sama mengirim
 * permintaan — `useCallback` baru dibuat ulang setelah render. State di sini
 * hanya untuk merender tombol yang dinonaktifkan.
 *
 * Ini bukan kenyamanan. Lapisan data kini punya kunci unik
 * `(planningId, sourceKey)` sehingga POST material kedua kalah di basis data
 * alih-alih menggandakan baris — tetapi kalah di sana berarti galat yang
 * dilihat perencana. Penjaga ini membuat permintaan keduanya tidak pernah
 * terkirim, dan ia juga satu-satunya penjaga bagi aksi yang tidak punya kunci
 * unik: penerbitan peta serta ubah/hapus titik yang sama.
 */
function usePenjagaPermintaan() {
  const berjalan = useRef<Set<string>>(new Set());
  const [kunciBerjalan, setKunciBerjalan] = useState<readonly string[]>([]);

  /** `false` bila kunci itu sudah berjalan; pemanggil wajib berhenti. */
  const mulai = useCallback((kunci: string): boolean => {
    if (berjalan.current.has(kunci)) return false;
    berjalan.current.add(kunci);
    setKunciBerjalan([...berjalan.current]);
    return true;
  }, []);

  const selesai = useCallback((kunci: string): void => {
    berjalan.current.delete(kunci);
    setKunciBerjalan([...berjalan.current]);
  }, []);

  return { kunciBerjalan, mulai, selesai };
}

/** Satu permintaan JSON; galat jaringan ikut dikembalikan sebagai hasil, bukan dilempar. */
async function kirimJson(url: string, init: RequestInit): Promise<HasilKirim> {
  try {
    const respons = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    const badan = await respons.json().catch((): null => null);
    return { berhasil: respons.ok, status: respons.status, badan };
  } catch {
    return { berhasil: false, status: 0, badan: null };
  }
}

/** Satu permintaan multipart; `Content-Type` dibiarkan diisi browser. */
async function kirimFormData(
  url: string,
  formData: FormData,
): Promise<HasilKirim> {
  try {
    const respons = await fetch(url, { method: "POST", body: formData });
    const badan = await respons.json().catch((): null => null);
    return { berhasil: respons.ok, status: respons.status, badan };
  } catch {
    return { berhasil: false, status: 0, badan: null };
  }
}

/**
 * Seluruh data dan perubahan peta rencana sebuah planning.
 *
 * Satu tanggung jawab: bicara dengan API peta dan menerjemahkan hasilnya
 * menjadi keadaan yang bisa dirender. Komponen peta, form, dan panel tidak
 * memanggil `fetch` sendiri.
 */
export function usePetaRencana(planningId: string) {
  const invalidatePlanning = useInvalidatePlanningRelated();
  const [pesan, setPesan] = useState<PesanPeta | null>(null);
  const { kunciBerjalan, mulai, selesai } = usePenjagaPermintaan();

  const urlPeta = `/api/planning/${planningId}/peta/titik?lingkup=semua`;
  const urlMaterial = `/api/planning/${planningId}/peta/material`;

  const {
    data: peta,
    isLoading: sedangMemuatPeta,
    refetch: ambilUlangPeta,
  } = useApi<PetaPlanningDTO>(urlPeta, {
    onError: () =>
      setPesan({ nada: "galat", teks: "Gagal memuat peta rencana" }),
  });

  const {
    data: rekap,
    isLoading: sedangMemuatRekap,
    refetch: ambilUlangRekap,
  } = useApi<KebutuhanMaterialOsp>(urlMaterial, {
    onError: () =>
      setPesan({ nada: "galat", teks: "Gagal memuat kebutuhan material" }),
  });

  /** Menyegarkan peta dan rekap sekaligus; keduanya berubah oleh perubahan apa pun. */
  const segarkan = useCallback(async () => {
    await Promise.all([ambilUlangPeta(), ambilUlangRekap()]);
  }, [ambilUlangPeta, ambilUlangRekap]);

  const bersihkanPesan = useCallback(() => setPesan(null), []);

  const tambahTitik = useCallback(
    async (input: BuatTitikRencanaInput): Promise<boolean> => {
      if (!mulai(KUNCI_TAMBAH_TITIK)) return false;
      try {
        const hasil = await kirimJson(
          `/api/planning/${planningId}/peta/titik`,
          {
            method: "POST",
            body: JSON.stringify(input),
          },
        );
        if (!hasil.berhasil) {
          setPesan({
            nada: "galat",
            teks: formatApiError(hasil.badan, "Gagal menambah titik rencana"),
          });
          return false;
        }
        setPesan({
          nada: "sukses",
          teks: `Titik "${input.name}" ditambahkan ke peta rencana.`,
        });
        await segarkan();
        invalidatePlanning();
        return true;
      } finally {
        selesai(KUNCI_TAMBAH_TITIK);
      }
    },
    [invalidatePlanning, mulai, planningId, segarkan, selesai],
  );

  /**
   * Mengubah satu titik rencana.
   *
   * Jalan satu-satunya memperbaiki rasio splitter yang salah: `hapusTitik`
   * menolak titik yang masih punya jalur, jadi tanpa jalur ubah ini titik
   * dengan satu kabel menempel tidak bisa dikoreksi sama sekali dari layar —
   * padahal rasio itu persis angka yang menjadi jumlah barang yang dibeli.
   */
  const ubahTitik = useCallback(
    async (nodeId: string, input: BuatTitikRencanaInput): Promise<boolean> => {
      const kunci = kunciUbahTitik(nodeId);
      if (!mulai(kunci)) return false;
      try {
        const hasil = await kirimJson(
          `/api/planning/${planningId}/peta/titik/${nodeId}`,
          { method: "PUT", body: JSON.stringify(input) },
        );

        if (hasil.status === STATUS_TIDAK_DITEMUKAN) {
          setPesan(pesanTidakAdaLagi(`Titik "${input.name}"`));
          await segarkan();
          return false;
        }

        if (!hasil.berhasil) {
          setPesan({
            nada: "galat",
            teks: formatApiError(hasil.badan, "Gagal mengubah titik rencana"),
          });
          return false;
        }

        setPesan({
          nada: "sukses",
          teks: `Titik "${input.name}" diperbarui.`,
        });
        await segarkan();
        invalidatePlanning();
        return true;
      } finally {
        selesai(kunci);
      }
    },
    [invalidatePlanning, mulai, planningId, segarkan, selesai],
  );

  /**
   * Mengunggah satu foto survei dan menautkannya ke titiknya.
   *
   * Memakai endpoint dokumen planning yang sudah ada (`nodeId` membuat
   * kategorinya dipaksa `SURVEY_PHOTO` di server), jadi tidak ada jalur
   * unggah baru.
   */
  const unggahFotoTitik = useCallback(
    async (nodeId: string, file: File): Promise<boolean> => {
      const kunci = kunciFotoTitik(nodeId);
      if (!mulai(kunci)) return false;
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("nodeId", nodeId);

        const hasil = await kirimFormData(
          `/api/planning/${planningId}/documents`,
          formData,
        );

        if (!hasil.berhasil) {
          setPesan({
            nada: "galat",
            teks: formatApiError(hasil.badan, "Gagal mengunggah foto titik"),
          });
          return false;
        }

        setPesan({
          nada: "sukses",
          teks: `Foto "${file.name}" ditautkan ke titik ini. Lihat tab Dokumen.`,
        });
        invalidatePlanning();
        return true;
      } finally {
        selesai(kunci);
      }
    },
    [invalidatePlanning, mulai, planningId, selesai],
  );

  const hapusTitik = useCallback(
    async (titik: TitikRencanaDTO): Promise<void> => {
      if (!mulai(titik.nodeId)) return;
      try {
        const hasil = await kirimJson(
          `/api/planning/${planningId}/peta/titik/${titik.nodeId}`,
          { method: "DELETE" },
        );

        if (hasil.status === STATUS_TIDAK_DITEMUKAN) {
          setPesan(
            pesanTidakAdaLagi(
              titik.name ? `Titik "${titik.name}"` : "Titik ini",
            ),
          );
          await segarkan();
          return;
        }

        if (!hasil.berhasil) {
          setPesan({
            nada: "galat",
            teks: formatApiError(hasil.badan, "Gagal menghapus titik rencana"),
          });
          return;
        }

        setPesan({ nada: "sukses", teks: "Titik rencana dihapus." });
        await segarkan();
        invalidatePlanning();
      } finally {
        selesai(titik.nodeId);
      }
    },
    [invalidatePlanning, mulai, planningId, segarkan, selesai],
  );

  const tambahJalur = useCallback(
    async (input: BuatJalurRencanaInput): Promise<boolean> => {
      if (!mulai(KUNCI_TAMBAH_JALUR)) return false;
      try {
        const hasil = await kirimJson(
          `/api/planning/${planningId}/peta/jalur`,
          {
            method: "POST",
            body: JSON.stringify(input),
          },
        );
        if (!hasil.berhasil) {
          setPesan({
            nada: "galat",
            teks: formatApiError(hasil.badan, "Gagal menambah jalur rencana"),
          });
          return false;
        }
        setPesan({ nada: "sukses", teks: "Jalur rencana ditambahkan." });
        await segarkan();
        invalidatePlanning();
        return true;
      } finally {
        selesai(KUNCI_TAMBAH_JALUR);
      }
    },
    [invalidatePlanning, mulai, planningId, segarkan, selesai],
  );

  const hapusJalur = useCallback(
    async (jalur: JalurRencanaDTO): Promise<void> => {
      if (!mulai(jalur.edgeId)) return;
      try {
        const hasil = await kirimJson(
          `/api/planning/${planningId}/peta/jalur/${jalur.edgeId}`,
          { method: "DELETE" },
        );

        if (hasil.status === STATUS_TIDAK_DITEMUKAN) {
          setPesan(pesanTidakAdaLagi("Jalur ini"));
          await segarkan();
          return;
        }

        if (!hasil.berhasil) {
          setPesan({
            nada: "galat",
            teks: formatApiError(hasil.badan, "Gagal menghapus jalur rencana"),
          });
          return;
        }

        setPesan({ nada: "sukses", teks: "Jalur rencana dihapus." });
        await segarkan();
        invalidatePlanning();
      } finally {
        selesai(jalur.edgeId);
      }
    },
    [invalidatePlanning, mulai, planningId, segarkan, selesai],
  );

  /**
   * Menerbitkan rekap menjadi item material.
   *
   * Penjaganya ada di `usePenjagaPermintaan` (berbasis `ref`, dibaca sebelum
   * `await`) — bukan kosmetik dan bukan sekadar pendamping atribut `disabled`
   * di tombol: ia menutup jalur non-klik, mis. dua pemanggilan dalam satu
   * tick. Penggandaan barisnya sendiri sudah ditutup kunci unik
   * `(planningId, sourceKey)` di basis data; penjaga ini yang membuat
   * perencana tidak pernah melihat galat bentrokan untuk klik keduanya.
   */
  const terbitkanMaterial = useCallback(
    async (spareKabelPersen: number): Promise<void> => {
      if (!mulai(KUNCI_TERBITKAN_MATERIAL)) return;
      try {
        const hasil = await kirimJson(urlMaterial, {
          method: "POST",
          body: JSON.stringify({ spareKabelPersen }),
        });
        if (!hasil.berhasil) {
          setPesan({
            nada: "galat",
            teks: formatApiError(hasil.badan, "Gagal menerbitkan material"),
          });
          return;
        }
        setPesan({
          nada: "sukses",
          teks: "Kebutuhan material diperbarui dari peta rencana. Lihat tab Material.",
        });
        await segarkan();
        invalidatePlanning();
      } finally {
        selesai(KUNCI_TERBITKAN_MATERIAL);
      }
    },
    [invalidatePlanning, mulai, segarkan, selesai, urlMaterial],
  );

  /**
   * Menerbitkan titik dan jalur rencana menjadi node jaringan nyata.
   *
   * Penjaganya sama dengan penerbitan material: tindakan ini memasukkan baris
   * ke topologi operasional, jadi dua permintaan yang tumpang-tindih tidak
   * boleh berjalan. 403 dijawab dengan kalimat yang menjelaskan apa yang
   * kurang, bukan gema galat API yang hanya menyebut nama izin.
   */
  const terbitkanPeta = useCallback(async (): Promise<boolean> => {
    if (!mulai(KUNCI_TERBITKAN_PETA)) return false;
    try {
      const hasil = await kirimJson(
        `/api/planning/${planningId}/peta/terbitkan`,
        { method: "POST" },
      );

      if (hasil.status === STATUS_DILARANG) {
        setPesan({ nada: "galat", teks: PESAN_TANPA_IZIN_TERBIT });
        return false;
      }

      if (!hasil.berhasil) {
        setPesan({
          nada: "galat",
          teks: formatApiError(hasil.badan, "Gagal menerbitkan peta rencana"),
        });
        return false;
      }

      const data = hasil.badan as {
        data?: { titikTerbit?: number; jalurTerbit?: number };
      } | null;
      const titikTerbit = data?.data?.titikTerbit ?? 0;
      const jalurTerbit = data?.data?.jalurTerbit ?? 0;

      setPesan({
        nada: titikTerbit + jalurTerbit > 0 ? "sukses" : "info",
        teks:
          titikTerbit + jalurTerbit > 0
            ? `${titikTerbit} titik dan ${jalurTerbit} jalur masuk ke peta jaringan. Titik yang sudah terbit tidak bisa diubah lagi dari rencana ini.`
            : "Tidak ada titik atau jalur rencana yang perlu diterbitkan — semuanya sudah masuk peta jaringan.",
      });
      await segarkan();
      invalidatePlanning();
      return true;
    } finally {
      selesai(KUNCI_TERBITKAN_PETA);
    }
  }, [invalidatePlanning, mulai, planningId, segarkan, selesai]);

  /** `true` selama permintaan hapus untuk titik/jalur itu masih berjalan. */
  const isSedangDihapus = useCallback(
    (id: string): boolean => kunciBerjalan.includes(id),
    [kunciBerjalan],
  );

  /** `true` selama permintaan ubah titik itu masih berjalan. */
  const isSedangDiubah = useCallback(
    (nodeId: string): boolean => kunciBerjalan.includes(kunciUbahTitik(nodeId)),
    [kunciBerjalan],
  );

  /** `true` selama unggah foto titik itu masih berjalan. */
  const isSedangUnggahFoto = useCallback(
    (nodeId: string): boolean => kunciBerjalan.includes(kunciFotoTitik(nodeId)),
    [kunciBerjalan],
  );

  return {
    peta,
    rekap,
    sedangMemuat: sedangMemuatPeta || sedangMemuatRekap,
    pesan,
    bersihkanPesan,
    sedangMenyimpanTitik: kunciBerjalan.includes(KUNCI_TAMBAH_TITIK),
    sedangMenyimpanJalur: kunciBerjalan.includes(KUNCI_TAMBAH_JALUR),
    sedangMenerbitkan: kunciBerjalan.includes(KUNCI_TERBITKAN_MATERIAL),
    sedangMenerbitkanPeta: kunciBerjalan.includes(KUNCI_TERBITKAN_PETA),
    isSedangDihapus,
    isSedangDiubah,
    isSedangUnggahFoto,
    tambahTitik,
    ubahTitik,
    hapusTitik,
    unggahFotoTitik,
    tambahJalur,
    hapusJalur,
    terbitkanMaterial,
    terbitkanPeta,
  };
}
