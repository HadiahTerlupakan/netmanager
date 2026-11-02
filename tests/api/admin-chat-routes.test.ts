import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  isFeatureEnabled: vi.fn(),
  searchUsers: vi.fn(),
  sendMessage: vi.fn(),
  getMessages: vi.fn(),
  getR2Settings: vi.fn(),
}));

vi.mock("next-auth", async () => {
  const actual = await vi.importActual<typeof import("next-auth")>("next-auth");
  return { ...actual, getServerSession: mocks.getServerSession };
});
vi.mock("@/modules/feature-flags", () => ({
  getFeatureFlagService: () => ({ isEnabled: mocks.isFeatureEnabled }),
}));
vi.mock("@/lib/utils/image-upload", () => ({
  getR2Settings: mocks.getR2Settings,
}));
vi.mock("@/modules/chat", async () => {
  const actual =
    await vi.importActual<typeof import("@/modules/chat")>("@/modules/chat");
  return {
    ...actual,
    ChatService: class {
      searchUsers = mocks.searchUsers;
      sendMessage = mocks.sendMessage;
      getMessages = mocks.getMessages;
    },
  };
});

import { GET as getUsers } from "@/app/api/admin/chat/users/route";
import {
  GET as getMessages,
  POST as postMessage,
} from "@/app/api/admin/chat/conversations/[id]/route";
import { CHAT_PESAN } from "@/modules/chat";

const params = (id = "conv-1") => ({ params: Promise.resolve({ id }) });

function login(permissions: string[]) {
  mocks.getServerSession.mockResolvedValue({
    user: {
      id: "user-1",
      email: "admin@radpro.id",
      name: "Admin",
      tenantId: "tenant-1",
      permissions,
    },
  });
}

function kirimPesan(body: unknown) {
  return postMessage(
    new NextRequest(
      "https://admin.radpro.id/api/admin/chat/conversations/conv-1",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "admin.radpro.id",
        },
        body: JSON.stringify(body),
      },
    ),
    params(),
  );
}

describe("admin chat routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXTAUTH_URL", "https://radpro.id");
    mocks.isFeatureEnabled.mockResolvedValue(true);
    mocks.getR2Settings.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("GET /api/admin/chat/users", () => {
    it("mencari di tenant pemanggil dengan kata yang diketik (dulu tertukar → selalu kosong)", async () => {
      login(["chat:read", "chat:create"]);
      mocks.searchUsers.mockResolvedValueOnce({ success: true, data: [] });

      const response = await getUsers(
        new NextRequest(
          "https://admin.radpro.id/api/admin/chat/users?search=bud",
        ),
        params(),
      );

      expect(response.status).toBe(200);
      expect(mocks.searchUsers).toHaveBeenCalledWith(
        { type: "user", id: "user-1" },
        "tenant-1",
        "bud",
      );
    });

    it("butuh izin chat:create", async () => {
      login(["chat:read"]);

      const response = await getUsers(
        new NextRequest("https://admin.radpro.id/api/admin/chat/users"),
        params(),
      );

      expect(response.status).toBe(403);
      expect(mocks.searchUsers).not.toHaveBeenCalled();
    });

    it("tertutup bila modul chat dimatikan untuk tenant", async () => {
      login(["chat:read", "chat:create"]);
      mocks.isFeatureEnabled.mockResolvedValueOnce(false);

      const response = await getUsers(
        new NextRequest("https://admin.radpro.id/api/admin/chat/users"),
        params(),
      );

      expect(response.status).toBe(403);
    });
  });

  describe("GET /api/admin/chat/conversations/[id]", () => {
    it("limit bukan angka → 400 dengan pesan, bukan 500", async () => {
      login(["chat:read"]);

      const response = await getMessages(
        new NextRequest(
          "https://admin.radpro.id/api/admin/chat/conversations/conv-1?limit=abc",
        ),
        params(),
      );

      expect(response.status).toBe(400);
      expect(mocks.getMessages).not.toHaveBeenCalled();
    });

    it("bukan anggota → 403 dengan pesan yang jelas", async () => {
      login(["chat:read"]);
      mocks.getMessages.mockResolvedValueOnce({
        success: false,
        code: "NOT_PARTICIPANT",
        error: CHAT_PESAN.NOT_PARTICIPANT,
      });

      const response = await getMessages(
        new NextRequest(
          "https://admin.radpro.id/api/admin/chat/conversations/conv-1",
        ),
        params(),
      );

      expect(response.status).toBe(403);
      expect((await response.json()).error).toBe(CHAT_PESAN.NOT_PARTICIPANT);
    });
  });

  describe("POST /api/admin/chat/conversations/[id]", () => {
    it("menolak gambar dari server luar (pelacak IP staf)", async () => {
      login(["chat:create"]);

      const response = await kirimPesan({
        imageUrl:
          "https://pelacak.example/uploads/tenants/tenant-1/chat/a.webp",
      });

      expect(response.status).toBe(400);
      expect(mocks.sendMessage).not.toHaveBeenCalled();
    });

    it("menolak gambar milik tenant lain walau dari host aplikasi", async () => {
      login(["chat:create"]);

      const response = await kirimPesan({
        imageUrl:
          "https://admin.radpro.id/uploads/tenants/tenant-2/chat/a.webp",
      });

      expect(response.status).toBe(400);
    });

    it("menolak gambar dari host luar walau header Host-nya dipalsukan", async () => {
      login(["chat:create"]);

      const response = await postMessage(
        new NextRequest(
          "https://pelacak.example/api/admin/chat/conversations/conv-1",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              host: "pelacak.example",
            },
            body: JSON.stringify({
              imageUrl:
                "https://pelacak.example/uploads/tenants/tenant-1/chat/a.webp",
            }),
          },
        ),
        params(),
      );

      expect(response.status).toBe(400);
      expect(mocks.sendMessage).not.toHaveBeenCalled();
    });

    it("menerima gambar hasil upload tenant sendiri", async () => {
      login(["chat:create"]);
      mocks.sendMessage.mockResolvedValueOnce({
        success: true,
        data: { id: "m1" },
      });

      const response = await kirimPesan({
        imageUrl:
          "https://admin.radpro.id/uploads/tenants/tenant-1/chat/a.webp",
      });

      expect(response.status).toBe(201);
    });

    it("body bukan JSON → 400 dengan pesan, bukan pesan kosong tersimpan", async () => {
      login(["chat:create"]);

      const response = await postMessage(
        new NextRequest(
          "https://admin.radpro.id/api/admin/chat/conversations/conv-1",
          { method: "POST", body: "halo" },
        ),
        params(),
      );

      expect(response.status).toBe(400);
      expect(mocks.sendMessage).not.toHaveBeenCalled();
    });
  });
});
