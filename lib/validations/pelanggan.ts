import { z } from 'zod';
import { Status, TipePelanggan, DiscountType, DurasiUnit } from '@prisma/client';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Helper for parsing boolean from FormData/string
const booleanString = z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === 'boolean') return val;
    return val === 'true' || val === 'on' || val === '1';
});

// Helper for parsing number from FormData/string
const numberString = z.union([z.number(), z.string(), z.null()]).transform((val) => {
    if (val === null || val === '') return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
});

export const createPelangganSchema = z.object({
    idPelanggan: z.string().length(8, 'ID Pelanggan harus 8 digit').regex(/^\d+$/, 'ID Pelanggan harus angka'),
    nama: z.string().min(3, 'Nama minimal 3 karakter'),
    username: z.string().min(3, 'Username minimal 3 karakter').regex(/^[a-zA-Z0-9_\-\.]+$/, 'Username hanya boleh huruf, angka, dot, dash, underscore'),
    password: z.string().min(1, 'Password PPPoE wajib diisi'),
    passwordLogin: z.string().min(6, 'Password login minimal 6 karakter'),
    hargaPaketId: z.string().min(1, 'Paket layanan wajib dipilih'),
    tipe: z.nativeEnum(TipePelanggan).default(TipePelanggan.REGULER),
    
    // Dates need to be strings "YYYY-MM-DD"
    tanggalAktif: z.string().regex(dateRegex, 'Format tanggal harus YYYY-MM-DD'),
    jatuhTempo: z.string().regex(dateRegex, 'Format tanggal harus YYYY-MM-DD'),
    
    status: z.nativeEnum(Status).default(Status.AKTIF),
    autoIsolir: booleanString.default(true),
    
    // Optional contact/address info
    alamat: z.string().optional().nullable(),
    provinsi: z.string().optional().nullable(),
    kabupatenKota: z.string().optional().nullable(),
    kelurahanDesa: z.string().optional().nullable(),
    kecamatan: z.string().optional().nullable(),
    noTelp: z.string().optional().nullable(),
    email: z.string().email('Email tidak valid').optional().nullable().or(z.literal('')),
    
    // Geo
    latitude: numberString.optional().nullable(),
    longitude: numberString.optional().nullable(),
    
    // Docs
    jenisDokumen: z.string().optional().nullable(),
    noDokumen: z.string().optional().nullable(),
    
    // Billing Config
    usePPN: booleanString.default(true),
    useDiscount: booleanString.default(false),
    useProrate: booleanString.default(false),
    catatan: z.string().optional().nullable(),
    
    // Discounts
    discountType: z.nativeEnum(DiscountType).optional().nullable(),
    discountValue: numberString.optional().nullable(),
    discountDuration: numberString.optional().nullable(),
    discountDurationUnit: z.nativeEnum(DurasiUnit).optional().nullable(),
    
    // One time fees
    biayaInstalasi: numberString.optional().nullable(),
    biayaInstalasiIsRecurring: booleanString.default(false),
    biayaInstalasiDiskon: numberString.optional().nullable(),
    
    biayaSewaPerangkat: numberString.optional().nullable(),
    biayaSewaPerangkatIsRecurring: booleanString.default(true),
    biayaSewaPerangkatDiskon: numberString.optional().nullable(),
    
    biayaLainnya: numberString.optional().nullable(),
    biayaLainnyaIsRecurring: booleanString.default(false),
    biayaLainnyaDiskon: numberString.optional().nullable(),
    keteranganBiayaLainnya: z.string().optional().nullable(),
    
    // Infrastructure
    odpId: z.string().optional().nullable(),
    siteId: z.string().optional().nullable(),
});

export type CreatePelangganSchema = z.infer<typeof createPelangganSchema>;
