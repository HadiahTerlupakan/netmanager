import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";
import { ProfilePPPService } from "@/modules/network/services/ProfilePPPService";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockFns = vi.hoisted(() => ({
  onProfilePppUpdated: vi.fn(),
  syncRadiusProfileOnUpdate: vi.fn(),
  syncMikroTikProfileOnUpdate: vi.fn(),
  buildUpdateProfilePPPData: vi.fn(),
}));

vi.mock("@/modules/database", () => ({
  prisma: prismaMock,
}));

vi.mock("@/modules/events", () => ({
  NetworkEventDispatcher: {
    onProfilePppUpdated: mockFns.onProfilePppUpdated,
  },
}));

vi.mock("@/modules/network/services/profile-ppp-radius-sync", () => ({
  syncRadiusProfileOnUpdate: mockFns.syncRadiusProfileOnUpdate,
  syncRadiusProfileOnCreate: vi.fn(),
}));

vi.mock("@/modules/network/services/profile-ppp-mikrotik-sync", () => ({
  syncMikroTikProfileOnUpdate: mockFns.syncMikroTikProfileOnUpdate,
  syncMikroTikProfileOnCreate: vi.fn(),
}));

vi.mock("@/modules/network/services/profile-ppp-prisma-data", () => ({
  buildUpdateProfilePPPData: mockFns.buildUpdateProfilePPPData,
  buildCreateProfilePPPData: vi.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SESSION_CONTEXT = {
  user: { id: "admin-1", tenantId: "tenant-1" },
} as never;

const OLD_PROFILE = {
  id: "profile-1",
  name: "Profile-10M",
  localAddress: "10.0.0.1",
  remoteAddress: "10.0.0.0/24",
  dnsServer: null as string | null,
  sessionTimeout: null as number | null,
  idleTimeout: null as number | null,
  poolMode: null as string | null,
  description: null as string | null,
  status: "AKTIF",
  siteId: "site-1" as string | null,
  mikroTikRouterId: null as string | null,
  tenantId: "tenant-1" as string | null,
};

const UPDATED_PROFILE = {
  ...OLD_PROFILE,
  name: "Profile-20M",
  remoteAddress: "10.1.0.0/24", // berubah → bandwidthChanged = true
};

const PROFILE_DATA = {
  name: "Profile-20M",
  localAddress: "10.0.0.1",
  remoteAddress: "10.1.0.0/24",
  dnsServer: null,
  sessionTimeout: null,
  idleTimeout: null,
  poolMode: null,
  description: null,
  status: "AKTIF",
  siteId: "site-1",
  bandwidthId: "bw-1",
} as never;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ProfilePPPService — emit PROFILE_PPP_UPDATED", () => {
  let repository: {
    updateProfilePpp: ReturnType<typeof vi.fn>;
    findProfilePppForUpdate: ReturnType<typeof vi.fn>;
    findProfilePpps: ReturnType<typeof vi.fn>;
    findProfilePppDetail: ReturnType<typeof vi.fn>;
    findProfilePppForDelete: ReturnType<typeof vi.fn>;
    createProfilePpp: ReturnType<typeof vi.fn>;
    deleteProfilePpp: ReturnType<typeof vi.fn>;
  };
  let service: ProfilePPPService;

  beforeEach(() => {
    vi.clearAllMocks();

    repository = {
      updateProfilePpp: vi.fn().mockResolvedValue(UPDATED_PROFILE),
      findProfilePppForUpdate: vi.fn(),
      findProfilePpps: vi.fn(),
      findProfilePppDetail: vi.fn(),
      findProfilePppForDelete: vi.fn(),
      createProfilePpp: vi.fn(),
      deleteProfilePpp: vi.fn(),
    };

    mockFns.buildUpdateProfilePPPData.mockReturnValue({});
    mockFns.syncRadiusProfileOnUpdate.mockResolvedValue(undefined);
    mockFns.syncMikroTikProfileOnUpdate.mockResolvedValue(undefined);
    mockFns.onProfilePppUpdated.mockResolvedValue(undefined);

    service = new ProfilePPPService(repository as never);
  });

  it("emit PROFILE_PPP_UPDATED dengan bandwidthChanged=true saat remoteAddress berubah", async () => {
    prismaMock.pelanggan.count.mockResolvedValue(5);

    await service.updateProfilePPP(
      SESSION_CONTEXT,
      "profile-1",
      OLD_PROFILE,
      PROFILE_DATA,
    );

    expect(mockFns.onProfilePppUpdated).toHaveBeenCalledOnce();
    expect(mockFns.onProfilePppUpdated).toHaveBeenCalledWith({
      profileId: "profile-1",
      profileName: "Profile-20M",
      bandwidthChanged: true,
      affectedCustomerCount: 5,
      tenantId: "tenant-1",
    });
  });

  it("emit PROFILE_PPP_UPDATED dengan bandwidthChanged=false saat field koneksi tidak berubah", async () => {
    const sameProfile = { ...OLD_PROFILE }; // tidak ada perubahan field
    repository.updateProfilePpp.mockResolvedValue(sameProfile);
    prismaMock.pelanggan.count.mockResolvedValue(3);

    await service.updateProfilePPP(
      SESSION_CONTEXT,
      "profile-1",
      OLD_PROFILE,
      PROFILE_DATA,
    );

    expect(mockFns.onProfilePppUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ bandwidthChanged: false }),
    );
  });

  it("query count pelanggan AKTIF yang pakai profile ini", async () => {
    prismaMock.pelanggan.count.mockResolvedValue(12);

    await service.updateProfilePPP(
      SESSION_CONTEXT,
      "profile-1",
      OLD_PROFILE,
      PROFILE_DATA,
    );

    expect(prismaMock.pelanggan.count).toHaveBeenCalledWith({
      where: {
        status: "AKTIF",
        hargaPaket: { profilePPPId: "profile-1" },
      },
    });
    expect(mockFns.onProfilePppUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ affectedCustomerCount: 12 }),
    );
  });

  it("tetap return profilePPP meski emit event gagal (best-effort)", async () => {
    prismaMock.pelanggan.count.mockRejectedValue(new Error("DB error"));

    const result = await service.updateProfilePPP(
      SESSION_CONTEXT,
      "profile-1",
      OLD_PROFILE,
      PROFILE_DATA,
    );

    // Update tetap sukses
    expect(result).toEqual(UPDATED_PROFILE);
    // Event tidak ter-emit karena error
    expect(mockFns.onProfilePppUpdated).not.toHaveBeenCalled();
  });
});
