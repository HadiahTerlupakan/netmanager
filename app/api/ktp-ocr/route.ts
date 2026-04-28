import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { GeminiOcrService, resolveGeminiMimeType } from "@/modules/settings";

const service = new GeminiOcrService();

const ktpSchema = {
  type: "OBJECT",
  properties: {
    nik: { type: "STRING", description: "Nomor Induk Kependudukan (16 digit)" },
    nama: { type: "STRING", description: "Nama Lengkap" },
    tempat_lahir: { type: "STRING", description: "Kota Tempat Lahir" },
    tanggal_lahir: {
      type: "STRING",
      description: "Tanggal Lahir (DD-MM-YYYY)",
    },
    jenis_kelamin: { type: "STRING", description: "Jenis Kelamin" },
    alamat_jalan: {
      type: "STRING",
      description: "Nama jalan, kampung, atau dusun dari alamat",
    },
    rt_rw: {
      type: "STRING",
      description: "Nomor RT dan RW dari alamat, format: 001/002",
    },
    kel_desa: {
      type: "STRING",
      description: "Nama Kelurahan atau Desa dari alamat",
    },
    kecamatan: { type: "STRING", description: "Nama Kecamatan dari alamat" },
    provinsi: { type: "STRING", description: "Nama Provinsi dari alamat" },
    agama: { type: "STRING", description: "Agama" },
    status_perkawinan: { type: "STRING", description: "Status Perkawinan" },
    pekerjaan: { type: "STRING", description: "Pekerjaan" },
    kewarganegaraan: { type: "STRING", description: "Kewarganegaraan" },
    berlaku_hingga: {
      type: "STRING",
      description: "Masa Berlaku (SEUMUR HIDUP atau tanggal)",
    },
    tempat_dikeluarkan: {
      type: "STRING",
      description:
        "Kota/Kabupaten tempat KTP dikeluarkan, biasanya di kanan bawah",
    },
    tanggal_dikeluarkan: {
      type: "STRING",
      description:
        "Tanggal KTP dikeluarkan (DD-MM-YYYY), biasanya di kanan bawah",
    },
  },
};

const ktpPrompt =
  'Analisis gambar KTP Indonesia ini dengan saksama. Ekstrak semua informasi secara detail sesuai skema JSON. Sangat PENTING: Kembalikan SEMUA medan (field) dalam skema, walaupun tidak dapat ditemukan pada gambar. Jika sebuah medan tidak ditemukan, kembalikan sebagai string kosong (""). Jangan menghilangkan medan apa pun dari respons JSON. Pecah alamat menjadi alamat_jalan, rt_rw, kel_desa, dan kecamatan. Pastikan format tanggal adalah DD-MM-YYYY. Jika bagian alamat tidak terbaca, gunakan konteks dari tempat_dikeluarkan untuk menyimpulkan informasi yang mungkin.';

export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json(
        { error: "Tidak terautentikasi" },
        { status: 401 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "File tidak ditemukan" },
        { status: 400 },
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File harus berupa gambar (PNG, JPG, JPEG)" },
        { status: 400 },
      );
    }

    const ktpData = await service.generateJson({
      tenantId: session.tenantId,
      prompt: ktpPrompt,
      mimeType: resolveGeminiMimeType(file.type),
      base64Data: Buffer.from(await file.arrayBuffer()).toString("base64"),
      responseSchema: ktpSchema,
    });

    return NextResponse.json({ data: ktpData });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat memproses KTP";
    const status = message.includes("API Key") ? 500 : 500;
    logger.error("Error processing KTP OCR:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
