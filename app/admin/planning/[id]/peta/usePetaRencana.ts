"use client";

import { useCallback, useState } from "react";

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

/**
 * Titik dan jalur rencana sudah hilang dari peta begitu diterbitkan menjadi
 * jaringan nyata, jadi 404 di sini tidak pernah berarti "salah alamat": ia
 * berarti layar ini lebih tua dari datanya. Pesan disusun dari apa yang
 * layar sendiri tahu, bukan dari teks galat API — "tidak ditemukan" untuk
 * titik yang masih terlihat hanya akan membuat perencana menebak.
 */
function pesanSudahTerbitTitik(nama: string | null): PesanPeta {
  const sebutan = nama ? `Titik "${nama}"` : "Titik ini";
  return {
    nada: "info",
    teks: `${sebutan} sudah terbit menjadi node jaringan nyata, jadi tidak lagi bisa diubah dari rencana. Peta sudah disegarkan.`,
  };
}

/** Lihat `pesanSudahTerbitTitik`; alasan yang sama berlaku untuk jalur. */
function pesanSudahTerbitJalur(): PesanPeta {
  return {
    nada: "info",
    teks: "Jalur ini sudah terbit menjadi kabel jaringan nyata, jadi tidak lagi bisa diubah dari rencana. Peta sudah disegarkan.",
  };
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
  const [sedangMenyimpanTitik, setSedangMenyimpanTitik] = useState(false);
  const [sedangMenyimpanJalur, setSedangMenyimpanJalur] = useState(false);
  const [sedangMenerbitkan, setSedangMenerbitkan] = useState(false);

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
      setSedangMenyimpanTitik(true);
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
        setSedangMenyimpanTitik(false);
      }
    },
    [invalidatePlanning, planningId, segarkan],
  );

  const hapusTitik = useCallback(
    async (titik: TitikRencanaDTO): Promise<void> => {
      const hasil = await kirimJson(
        `/api/planning/${planningId}/peta/titik/${titik.nodeId}`,
        { method: "DELETE" },
      );

      if (hasil.status === STATUS_TIDAK_DITEMUKAN) {
        setPesan(pesanSudahTerbitTitik(titik.name));
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
    },
    [invalidatePlanning, planningId, segarkan],
  );

  const tambahJalur = useCallback(
    async (input: BuatJalurRencanaInput): Promise<boolean> => {
      setSedangMenyimpanJalur(true);
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
        setSedangMenyimpanJalur(false);
      }
    },
    [invalidatePlanning, planningId, segarkan],
  );

  const hapusJalur = useCallback(
    async (jalur: JalurRencanaDTO): Promise<void> => {
      const hasil = await kirimJson(
        `/api/planning/${planningId}/peta/jalur/${jalur.edgeId}`,
        { method: "DELETE" },
      );

      if (hasil.status === STATUS_TIDAK_DITEMUKAN) {
        setPesan(pesanSudahTerbitJalur());
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
    },
    [invalidatePlanning, planningId, segarkan],
  );

  /**
   * Menerbitkan rekap menjadi item material.
   *
   * Penjaga `sedangMenerbitkan` bukan kosmetik: lapisan data belum punya
   * kunci konkurensi (tidak ada unique index `planningId + sourceKey`), jadi
   * dua permintaan yang tumpang-tindih menggandakan baris material dan
   * duplikatnya menetap — anggaran terhitung dobel tanpa sembuh sendiri.
   */
  const terbitkanMaterial = useCallback(
    async (spareKabelPersen: number): Promise<void> => {
      if (sedangMenerbitkan) return;
      setSedangMenerbitkan(true);
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
        setSedangMenerbitkan(false);
      }
    },
    [invalidatePlanning, segarkan, sedangMenerbitkan, urlMaterial],
  );

  return {
    peta,
    rekap,
    sedangMemuat: sedangMemuatPeta || sedangMemuatRekap,
    pesan,
    bersihkanPesan,
    sedangMenyimpanTitik,
    sedangMenyimpanJalur,
    sedangMenerbitkan,
    tambahTitik,
    hapusTitik,
    tambahJalur,
    hapusJalur,
    terbitkanMaterial,
  };
}
