import * as z from "zod";

import {
  DEFAULT_MESSAGE_LIMIT,
  MAX_BROADCAST_TITLE_LENGTH,
  MAX_CONVERSATION_NAME_LENGTH,
  MAX_CONVERSATION_PARTICIPANTS,
  MAX_ID_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_MESSAGE_LIMIT,
  MAX_USER_SEARCH_LENGTH,
} from "../domain/chat.constants";

/**
 * Skema input chat yang dipakai bersama rute admin dan mobile. Pesan galatnya
 * ditujukan ke pengguna: apa yang salah dan apa yang harus dilakukan.
 */

const idSchema = (pesan: string) =>
  z
    .string({ error: pesan })
    .trim()
    .min(1, { error: pesan })
    .max(MAX_ID_LENGTH, { error: pesan });

const PESAN_PESERTA_TIDAK_DIKENAL =
  "Orang yang dipilih tidak dikenali. Tutup jendela ini, lalu pilih lagi dari daftar.";

/** Body pembuatan percakapan baru. */
export const createConversationSchema = z.object({
  participantIds: z
    .array(idSchema(PESAN_PESERTA_TIDAK_DIKENAL), {
      error: "Pilih minimal 1 orang untuk diajak chat.",
    })
    .min(1, { error: "Pilih minimal 1 orang untuk diajak chat." })
    .max(MAX_CONVERSATION_PARTICIPANTS, {
      error: `Terlalu banyak orang dipilih. Maksimal ${MAX_CONVERSATION_PARTICIPANTS} orang dalam satu percakapan.`,
    }),
  name: z
    .string({ error: "Nama grup harus berupa tulisan." })
    .trim()
    .max(MAX_CONVERSATION_NAME_LENGTH, {
      error: `Nama grup terlalu panjang. Maksimal ${MAX_CONVERSATION_NAME_LENGTH} huruf.`,
    })
    .optional(),
});

/** Body pengiriman pesan: teks, gambar, atau keduanya. */
export const sendMessageSchema = z
  .object({
    content: z
      .string({ error: "Isi pesan harus berupa tulisan." })
      .max(MAX_MESSAGE_LENGTH, {
        error: `Pesan terlalu panjang. Maksimal ${MAX_MESSAGE_LENGTH} huruf; bagi menjadi beberapa pesan.`,
      })
      .nullish(),
    imageUrl: z
      .url({ error: "Gambar tidak terbaca. Kirim ulang gambarnya." })
      .nullish(),
  })
  .refine((pesan) => Boolean(pesan.content?.trim() || pesan.imageUrl), {
    error: "Pesan masih kosong. Tulis pesan atau pilih gambar dulu.",
  });

/** Body broadcast ke chat global tenant. */
export const broadcastSchema = z.object({
  content: z
    .string({ error: "Isi broadcast wajib diisi." })
    .trim()
    .min(1, { error: "Isi broadcast masih kosong. Tulis pesannya dulu." })
    .max(MAX_MESSAGE_LENGTH, {
      error: `Isi broadcast terlalu panjang. Maksimal ${MAX_MESSAGE_LENGTH} huruf.`,
    }),
  title: z
    .string({ error: "Judul broadcast harus berupa tulisan." })
    .trim()
    .max(MAX_BROADCAST_TITLE_LENGTH, {
      error: `Judul broadcast terlalu panjang. Maksimal ${MAX_BROADCAST_TITLE_LENGTH} huruf.`,
    })
    .optional()
    .transform((judul) => (judul ? judul : undefined)),
});

/** Query halaman pesan: cursor pesan terakhir dan jumlah per halaman. */
export const messagesQuerySchema = z.object({
  cursor: idSchema(
    "Posisi halaman pesan tidak valid. Muat ulang percakapan.",
  ).optional(),
  limit: z.coerce
    .number({ error: "Jumlah pesan per halaman harus berupa angka." })
    .int({ error: "Jumlah pesan per halaman harus bilangan bulat." })
    .min(1, { error: "Jumlah pesan per halaman minimal 1." })
    .max(MAX_MESSAGE_LIMIT, {
      error: `Jumlah pesan per halaman maksimal ${MAX_MESSAGE_LIMIT}.`,
    })
    .default(DEFAULT_MESSAGE_LIMIT),
});

/** Query pencarian karyawan untuk diajak chat. */
export const userSearchQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(MAX_USER_SEARCH_LENGTH, {
      error: `Kata pencarian terlalu panjang. Maksimal ${MAX_USER_SEARCH_LENGTH} huruf.`,
    })
    .optional()
    .transform((kata) => (kata ? kata : undefined)),
});

export type CreateConversationBody = z.infer<typeof createConversationSchema>;
export type SendMessageBody = z.infer<typeof sendMessageSchema>;
export type BroadcastBody = z.infer<typeof broadcastSchema>;
export type MessagesQuery = z.infer<typeof messagesQuerySchema>;
