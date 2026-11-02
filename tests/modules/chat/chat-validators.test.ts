import { describe, expect, it } from "vitest";

import {
  broadcastSchema,
  createConversationSchema,
  messagesQuerySchema,
  sendMessageSchema,
} from "@/modules/chat";

describe("messagesQuerySchema", () => {
  it("default 50 pesan bila limit tidak dikirim", () => {
    expect(messagesQuerySchema.parse({})).toEqual({ limit: 50 });
  });

  it.each(["abc", "0", "101", "-5", "2.5"])(
    "menolak limit %s (dulu NaN → 500, 0 → loop tanpa akhir, besar → query berat)",
    (limit) => {
      expect(messagesQuerySchema.safeParse({ limit }).success).toBe(false);
    },
  );
});

describe("sendMessageSchema", () => {
  it("menolak pesan kosong dengan pesan yang jelas", () => {
    const result = sendMessageSchema.safeParse({ content: "   " });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Pesan masih kosong. Tulis pesan atau pilih gambar dulu.",
    );
  });

  it("membatasi panjang pesan 5000 huruf", () => {
    expect(
      sendMessageSchema.safeParse({ content: "a".repeat(5001) }).success,
    ).toBe(false);
  });

  it("menerima null dari klien lama selama ada gambar", () => {
    expect(
      sendMessageSchema.safeParse({
        content: null,
        imageUrl: "https://radpro.id/uploads/tenants/t1/chat/a.webp",
      }).success,
    ).toBe(true);
  });
});

describe("createConversationSchema", () => {
  it("menolak id peserta yang bukan teks (dulu Prisma error → 500)", () => {
    expect(
      createConversationSchema.safeParse({ participantIds: [123] }).success,
    ).toBe(false);
  });

  it("menolak daftar peserta kosong", () => {
    const result = createConversationSchema.safeParse({ participantIds: [] });
    expect(result.error?.issues[0]?.message).toBe(
      "Pilih minimal 1 orang untuk diajak chat.",
    );
  });
});

describe("broadcastSchema", () => {
  it("membuang judul kosong dan memangkas spasi", () => {
    expect(
      broadcastSchema.parse({ content: "  Server restart  ", title: "  " }),
    ).toEqual({ content: "Server restart", title: undefined });
  });
});
