"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { useInvalidatePresurveiKonversi } from "@/lib/hooks/useInvalidate";
import { formatApiError } from "@/lib/utils/api-response-parser";
import type { ProspekStatus } from "@/modules/presurvei/client";

import {
  buildJadikanCanvasingUrl,
  isPerluTandaiDeal,
  kunciSetelahKonversi,
  pesanDealTanpaCanvasing,
  type MuatanKonversi,
} from "./konversiFormState";
import { buildUbahProspekUrl } from "./pindahProspek";

const PESAN_GAGAL_TANDAI_DEAL = "Gagal memindahkan prospek ke Deal";
const PESAN_GAGAL_KONVERSI = "Gagal menjadikan prospek canvasing";
const PESAN_BERHASIL = "Prospek berhasil dijadikan canvasing";

/**
 * Lama pesan "sudah Deal, canvasing belum dibuat" bertahan, dalam milidetik;
 * sama dengan pesan dua kalimat di `usePindahProspek.ts`.
 */
const DURASI_PESAN_SETENGAH_JALAN = 8000;

/** Hasil satu permintaan: berhasil atau tidak, beserta badan yang terbaca. */
interface HasilKirim {
  isOk: boolean;
  badan: unknown;
}

/** Kirim JSON; kegagalan jaringan dilaporkan sebagai `isOk: false`, bukan dilempar. */
async function kirimJson(
  url: string,
  method: "PATCH" | "POST",
  muatan: unknown,
): Promise<HasilKirim> {
  try {
    const respons = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(muatan),
    });
    const badan: unknown = await respons.json().catch((): null => null);
    return { isOk: respons.ok, badan };
  } catch {
    return { isOk: false, badan: null };
  }
}

/**
 * Promosi prospek ke canvasing dalam dua langkah berurutan.
 *
 * 1. Bila prospek belum DEAL: `PATCH { status: "DEAL" }` — server menegakkan
 *    transisinya.
 * 2. `POST .../jadikan-canvasing`.
 *
 * Kedua langkah tidak atomik, dan dua keputusan membaca status dari sumber
 * yang berbeda:
 *
 * - **Kirim PATCH atau tidak** membaca `statusTerkini`. State ini diisi sekali
 *   dari `statusAsal` dan TIDAK mengikuti prop sesudahnya, jadi hanya
 *   `setStatusTerkini("DEAL")` yang mencegah PATCH kedua saat simpan diulang
 *   — sebelum maupun sesudah rincian diambil ulang.
 * - **Pesan setengah jalan atau pesan server** membaca `statusAsal`, prop
 *   yang mengikuti rincian. Cabang setengah jalan menginvalidasi rincian,
 *   yang merupakan query aktif `useApi` di `KonversiModal`. Setelah diambil
 *   ulang, `statusAsal` sudah `DEAL`, dan kegagalan simpan ulang ditampilkan
 *   sebagai pesan server apa adanya; kepala modal sudah menampilkan Deal.
 */
export function useJadikanCanvasing(
  prospekId: string,
  statusAsal: ProspekStatus,
  onBerhasil: () => void,
) {
  const queryClient = useQueryClient();
  const invalidasiKonversi = useInvalidatePresurveiKonversi();
  const [isMenyimpan, setIsMenyimpan] = useState(false);
  const [statusTerkini, setStatusTerkini] = useState(statusAsal);
  const kunciPresurvei = kunciSetelahKonversi(prospekId, statusAsal);

  /** Buang cache presurvei saja: status sudah DEAL, canvasing belum ada. */
  const invalidasiPresurvei = () => {
    for (const queryKey of kunciPresurvei) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  /** Jalankan kedua langkah konversi untuk muatan yang sudah tervalidasi. */
  const jadikan = async (muatan: MuatanKonversi) => {
    setIsMenyimpan(true);
    try {
      if (isPerluTandaiDeal(statusTerkini)) {
        const tandai = await kirimJson(
          buildUbahProspekUrl(prospekId),
          "PATCH",
          {
            status: "DEAL",
          },
        );
        if (!tandai.isOk) {
          toast.error(formatApiError(tandai.badan, PESAN_GAGAL_TANDAI_DEAL));
          return;
        }
        setStatusTerkini("DEAL");
      }

      const konversi = await kirimJson(
        buildJadikanCanvasingUrl(prospekId),
        "POST",
        muatan,
      );
      if (!konversi.isOk) {
        const alasan = formatApiError(konversi.badan, PESAN_GAGAL_KONVERSI);
        if (isPerluTandaiDeal(statusAsal)) {
          // Status dibaca dari rincian saat render. Bila rincian sudah diambil
          // ulang setelah PATCH, cabang ini tidak tercapai lagi, dan kegagalan
          // berikutnya ditangani sebagai kesalahan biasa di bawah.
          invalidasiPresurvei();
          toast.error(pesanDealTanpaCanvasing(alasan), {
            duration: DURASI_PESAN_SETENGAH_JALAN,
          });
          return;
        }
        toast.error(alasan);
        return;
      }

      invalidasiKonversi(kunciPresurvei);
      toast.success(PESAN_BERHASIL);
      onBerhasil();
    } finally {
      setIsMenyimpan(false);
    }
  };

  return { jadikan, isMenyimpan };
}
