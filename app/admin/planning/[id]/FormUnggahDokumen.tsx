"use client";

import { useRef, useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/Button";
import { useInvalidatePlanningRelated } from "@/lib/hooks/useInvalidate";
import { formatApiError } from "@/lib/utils/api-response-parser";

/**
 * Kategori yang bisa dipilih untuk lampiran tingkat proyek.
 *
 * `SURVEY_PHOTO` tidak ada di sini: foto survei selalu menempel pada satu
 * titik dan diunggah dari popup titik di tab Peta, yang memaksa kategorinya
 * di server.
 */
const KATEGORI_LAMPIRAN = [
  { nilai: "APPROVAL_DOCUMENT", label: "Dokumen izin / persetujuan" },
  { nilai: "TECHNICAL_DRAWING", label: "Gambar teknis" },
  { nilai: "NETWORK_DIAGRAM", label: "Diagram jaringan" },
  { nilai: "COMPLETION_PHOTO", label: "Foto penyelesaian" },
  { nilai: "OTHER", label: "Lainnya" },
] as const;

/** Tipe yang diterima server: gambar apa pun, atau PDF. */
const TIPE_DITERIMA = "image/*,application/pdf";

interface FormUnggahDokumenProps {
  planningId: string;
}

/**
 * Unggah satu lampiran dokumen ke sebuah planning.
 *
 * Tanpa form ini, dukungan PDF di server hanya bisa dipakai lewat curl: tab
 * Dokumen dulu cuma menampilkan daftar, dan satu-satunya jalur unggah adalah
 * popup titik di tab Peta — yang hanya menerima gambar dan selalu menautkan
 * berkasnya ke sebuah titik.
 */
export function FormUnggahDokumen({ planningId }: FormUnggahDokumenProps) {
  const invalidatePlanning = useInvalidatePlanningRelated();
  const inputBerkas = useRef<HTMLInputElement | null>(null);
  const [kategori, setKategori] = useState<string>("APPROVAL_DOCUMENT");
  const [keterangan, setKeterangan] = useState("");
  const [sedangUnggah, setSedangUnggah] = useState(false);

  const unggah = async (berkas: File) => {
    setSedangUnggah(true);
    try {
      const formData = new FormData();
      formData.append("file", berkas);
      formData.append("category", kategori);
      if (keterangan.trim()) formData.append("description", keterangan.trim());

      const respons = await fetch(`/api/planning/${planningId}/documents`, {
        method: "POST",
        body: formData,
      });
      const badan = await respons.json().catch((): null => null);

      if (!respons.ok) {
        toast.error(formatApiError(badan, "Gagal mengunggah dokumen"));
        return;
      }

      toast.success(`"${berkas.name}" berhasil diunggah`);
      setKeterangan("");
      invalidatePlanning();
    } catch {
      toast.error("Gagal mengunggah dokumen");
    } finally {
      setSedangUnggah(false);
      // Dikosongkan supaya memilih berkas yang sama dua kali tetap memicu
      // `change` — tanpa ini, unggah ulang setelah gagal tampak diam saja.
      if (inputBerkas.current) inputBerkas.current.value = "";
    }
  };

  return (
    <div className="mb-5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            className="block text-xs font-medium text-gray-600 dark:text-gray-300"
            htmlFor="kategori-dokumen"
          >
            Kategori
          </label>
          <select
            id="kategori-dokumen"
            value={kategori}
            onChange={(e) => setKategori(e.target.value)}
            disabled={sedangUnggah}
            className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-white"
          >
            {KATEGORI_LAMPIRAN.map((item) => (
              <option key={item.nilai} value={item.nilai}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            className="block text-xs font-medium text-gray-600 dark:text-gray-300"
            htmlFor="keterangan-dokumen"
          >
            Keterangan (opsional)
          </label>
          <input
            id="keterangan-dokumen"
            type="text"
            value={keterangan}
            maxLength={500}
            onChange={(e) => setKeterangan(e.target.value)}
            disabled={sedangUnggah}
            placeholder="mis. Izin galian RW 04"
            className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-white"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={inputBerkas}
          id="berkas-dokumen"
          type="file"
          accept={TIPE_DITERIMA}
          disabled={sedangUnggah}
          className="text-xs"
          onChange={(e) => {
            const berkas = e.target.files?.[0];
            if (berkas) void unggah(berkas);
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={sedangUnggah}
          onClick={() => inputBerkas.current?.click()}
        >
          {sedangUnggah ? "Mengunggah…" : "Pilih berkas"}
        </Button>
      </div>

      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        Gambar maksimal 5MB, PDF maksimal 15MB. Foto survei per titik diunggah
        dari popup titik di tab Peta.
      </p>
    </div>
  );
}
