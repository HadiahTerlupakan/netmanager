import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppVersionService } from "@/modules/app-version/services/AppVersionService";
import type { IAppVersionRepository } from "@/modules/app-version/domain/ports/IAppVersionRepository";
import type { AppVersionWithUser } from "@/modules/app-version/domain/entities/AppVersionEntity";

const {
  mockUnlink,
  mockDeleteFromR2,
  mockStreamR2ObjectToFile,
  mockGetR2ObjectMetadata,
  mockGetR2Settings,
  mockIsR2Enabled,
  mockUploadToR2,
  mockGenerateR2Key,
} = vi.hoisted(() => ({
  mockUnlink: vi.fn(),
  mockDeleteFromR2: vi.fn(),
  mockStreamR2ObjectToFile: vi.fn(),
  mockGetR2ObjectMetadata: vi.fn(),
  mockGetR2Settings: vi.fn(),
  mockIsR2Enabled: vi.fn(),
  mockUploadToR2: vi.fn(),
  mockGenerateR2Key: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  default: {
    unlink: mockUnlink,
  },
}));

vi.mock("@/lib/utils/r2-client", () => ({
  isR2Enabled: mockIsR2Enabled,
  uploadToR2: mockUploadToR2,
  generateR2Key: mockGenerateR2Key,
  deleteFromR2: mockDeleteFromR2,
  streamR2ObjectToFile: mockStreamR2ObjectToFile,
  getR2ObjectMetadata: mockGetR2ObjectMetadata,
  getR2Settings: mockGetR2Settings,
}));

type MockedRepository = IAppVersionRepository;

type RepositoryMocks = {
  [Key in keyof IAppVersionRepository]: ReturnType<typeof vi.fn>;
};

const asRepositoryMocks = (repository: IAppVersionRepository) =>
  repository as unknown as RepositoryMocks;

const baseVersion: AppVersionWithUser = {
  id: "ver-1",
  version: "1.0.54",
  buildNumber: 54,
  versionCode: 54,
  platform: "android",
  apkUrl: "https://example.com/app.apk",
  apkSize: 1024n,
  releaseNotes: "Fixes",
  isForceUpdate: false,
  minVersion: "1.0.50",
  isActive: true,
  publishedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: null,
  user: null,
  tenantId: null,
};

describe("AppVersionService", () => {
  let service: AppVersionService;
  let repository: MockedRepository;
  let repositoryMocks: RepositoryMocks;

  beforeEach(() => {
    repository = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByVersion: vi.fn(),
      findByVersionCode: vi.fn(),
      getLatestVersion: vi.fn(),
      getRolloutStatsByVersionCode: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
    } as unknown as IAppVersionRepository;
    repositoryMocks = asRepositoryMocks(repository);
    service = new AppVersionService(repository);
    mockUnlink.mockReset();
    mockUnlink.mockResolvedValue(undefined);
    mockDeleteFromR2.mockReset();
    mockStreamR2ObjectToFile.mockReset();
    mockGetR2ObjectMetadata.mockReset();
    mockGetR2Settings.mockReset();
    mockIsR2Enabled.mockReset();
    mockUploadToR2.mockReset();
    mockGenerateR2Key.mockReset();
    mockGetR2Settings.mockResolvedValue({
      publicUrl: "https://cdn.example.com",
      bucketName: "bucket-name",
      accountId: "account-id",
    });
    mockIsR2Enabled.mockResolvedValue(true);
    mockGenerateR2Key.mockReturnValue("uploads/apk/generated.apk");
  });

  describe("evaluateVersionAccess", () => {
    it("returns supported when no active app version exists", async () => {
      repositoryMocks.getLatestVersion.mockResolvedValueOnce(null);

      const result = await service.evaluateVersionAccess(10);

      expect(result.isSupported).toBe(true);
      expect(result.updateAvailable).toBe(false);
      expect(result.isForceUpdate).toBe(false);
      expect(result.latestVersion).toBeNull();
    });

    it("forces update when client is below configured minimum version", async () => {
      repositoryMocks.getLatestVersion.mockResolvedValueOnce({
        ...baseVersion,
      });

      const result = await service.evaluateVersionAccess(49);

      expect(result.isSupported).toBe(false);
      expect(result.updateAvailable).toBe(true);
      expect(result.isForceUpdate).toBe(true);
      expect(result.minimumVersion).toBe("1.0.50");
      expect(result.latestVersion?.versionCode).toBe(54);
    });

    it("allows older clients when update is optional", async () => {
      repositoryMocks.getLatestVersion.mockResolvedValueOnce({
        ...baseVersion,
        id: "ver-2",
        apkUrl: "/uploads/app.apk",
        apkSize: 2048,
        minVersion: null,
      });

      const result = await service.evaluateVersionAccess(53);

      expect(result.isSupported).toBe(true);
      expect(result.updateAvailable).toBe(true);
      expect(result.isForceUpdate).toBe(false);
      expect(result.latestVersion?.downloadUrl).toBe(
        "/api/mobile/app-version/download/ver-2",
      );
    });

    it("forces update when latest version is marked mandatory", async () => {
      repositoryMocks.getLatestVersion.mockResolvedValueOnce({
        ...baseVersion,
        id: "ver-3",
        releaseNotes: null,
        apkSize: null,
        isForceUpdate: true,
        minVersion: null,
      });

      const result = await service.evaluateVersionAccess(53);

      expect(result.isSupported).toBe(false);
      expect(result.isForceUpdate).toBe(true);
    });
  });

  describe("updateVersion", () => {
    it("forwards only provided fields when minVersion is omitted", async () => {
      repositoryMocks.findById.mockResolvedValueOnce(baseVersion);
      repositoryMocks.update.mockImplementationOnce(async (_id, data) => ({
        ...baseVersion,
        ...data,
      }));

      await service.updateVersion(baseVersion.id, {
        releaseNotes: "Patched notes",
        isForceUpdate: true,
        isActive: true,
      });

      expect(repositoryMocks.update).toHaveBeenCalledWith(baseVersion.id, {
        releaseNotes: "Patched notes",
        isForceUpdate: true,
        isActive: true,
      });
    });

    it("allows explicitly clearing minVersion with null", async () => {
      repositoryMocks.findById.mockResolvedValueOnce(baseVersion);
      repositoryMocks.update.mockImplementationOnce(async (_id, data) => ({
        ...baseVersion,
        ...data,
      }));

      await service.updateVersion(baseVersion.id, {
        minVersion: null,
      });

      expect(repositoryMocks.update).toHaveBeenCalledWith(baseVersion.id, {
        minVersion: null,
      });
    });
  });

  describe("uploadVersion", () => {
    it("auto-detects version metadata from a pre-uploaded APK object", async () => {
      const createdVersion = {
        ...baseVersion,
        version: "1.0.80",
        buildNumber: 80,
        versionCode: 80,
        apkUrl: "https://cdn.example.com/uploads/apk/netmanager_v1.0.80.apk",
      };

      mockGetR2ObjectMetadata.mockResolvedValueOnce({
        contentLength: 4096,
        contentType: "application/vnd.android.package-archive",
      });
      mockStreamR2ObjectToFile.mockResolvedValueOnce(undefined);
      repositoryMocks.exists.mockResolvedValueOnce({
        versionExists: false,
        versionCodeExists: false,
      });
      repositoryMocks.create.mockResolvedValueOnce(createdVersion);

      vi.spyOn(service, "parseApkInfo").mockResolvedValueOnce({
        versionName: "1.0.80",
        buildNumber: 80,
        versionCode: 80,
        packageName: "com.example.netmanager",
      });

      const result = await service.uploadVersion({
        uploadedKey: "uploads/apk/app.apk",
        uploadedFilename: "app.apk",
        platform: "android",
        isForceUpdate: true,
      });

      expect(mockGetR2ObjectMetadata).toHaveBeenCalledWith(
        "uploads/apk/app.apk",
      );
      expect(mockStreamR2ObjectToFile).toHaveBeenCalledWith(
        "uploads/apk/app.apk",
        expect.stringMatching(/apk_uploaded_.+\.apk$/),
      );
      expect(service.parseApkInfo).toHaveBeenCalledWith({
        path: expect.stringMatching(/apk_uploaded_.+\.apk$/),
      });
      expect(repositoryMocks.exists).toHaveBeenCalledWith("1.0.80", 80);
      expect(repositoryMocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          version: "1.0.80",
          buildNumber: 80,
          versionCode: 80,
          apkSize: 4096n,
          isForceUpdate: true,
        }),
      );
      expect(result).toEqual(createdVersion);
    });

    it("rejects direct-upload metadata when uploaded size mismatches object metadata", async () => {
      mockGetR2ObjectMetadata.mockResolvedValueOnce({
        contentLength: 2048,
        contentType: "application/vnd.android.package-archive",
      });

      await expect(
        service.uploadVersion({
          uploadedKey: "uploads/apk/app.apk",
          uploadedFilename: "app.apk",
          uploadedSize: 1024,
          version: "1.0.80",
          buildNumber: 80,
          versionCode: 80,
          platform: "android",
        }),
      ).rejects.toThrow("Ukuran file APK yang diupload tidak sesuai");

      expect(mockStreamR2ObjectToFile).not.toHaveBeenCalled();
      expect(repositoryMocks.create).not.toHaveBeenCalled();
    });

    it("rejects uploaded keys outside the APK namespace", async () => {
      await expect(
        service.uploadVersion({
          uploadedKey: "uploads/other/app.apk",
          uploadedFilename: "app.apk",
          version: "1.0.80",
          buildNumber: 80,
          versionCode: 80,
          platform: "android",
        }),
      ).rejects.toThrow("Lokasi file direct upload tidak valid");

      expect(mockGetR2ObjectMetadata).not.toHaveBeenCalled();
      expect(repositoryMocks.create).not.toHaveBeenCalled();
    });

    it("rejects manual metadata that does not match the uploaded APK manifest", async () => {
      mockGetR2ObjectMetadata.mockResolvedValueOnce({
        contentLength: 4096,
        contentType: "application/vnd.android.package-archive",
      });
      mockStreamR2ObjectToFile.mockResolvedValueOnce(undefined);

      vi.spyOn(service, "parseApkInfo").mockResolvedValueOnce({
        versionName: "1.0.80",
        buildNumber: 80,
        versionCode: 80,
        packageName: "com.example.netmanager",
      });

      await expect(
        service.uploadVersion({
          uploadedKey: "uploads/apk/direct.apk",
          uploadedFilename: "direct.apk",
          version: "1.0.81",
          buildNumber: 81,
          versionCode: 81,
          platform: "android",
        }),
      ).rejects.toThrow("Metadata versi tidak cocok dengan APK yang diupload");

      expect(service.parseApkInfo).toHaveBeenCalledWith({
        path: expect.stringMatching(/apk_uploaded_.+\.apk$/),
      });
      expect(repositoryMocks.create).not.toHaveBeenCalled();
    });

    it("cleans up stored APK when database create fails after backend upload", async () => {
      mockUploadToR2.mockResolvedValueOnce(
        "https://cdn.example.com/uploads/apk/generated.apk",
      );
      repositoryMocks.exists.mockResolvedValueOnce({
        versionExists: false,
        versionCodeExists: false,
      });
      repositoryMocks.create.mockRejectedValueOnce(
        new Error("db create failed"),
      );

      vi.spyOn(service, "parseApkInfo").mockResolvedValueOnce({
        versionName: "1.0.80",
        buildNumber: 80,
        versionCode: 80,
        packageName: "com.example.netmanager",
      });

      await expect(
        service.uploadVersion({
          apkBuffer: Buffer.from("fake-apk"),
          apkFilename: "release.apk",
          platform: "android",
        }),
      ).rejects.toThrow("Gagal mengunggah versi aplikasi: db create failed");

      expect(mockUploadToR2).toHaveBeenCalledTimes(1);
      expect(mockDeleteFromR2).not.toHaveBeenCalled();
    });
  });

  describe("deleteVersion", () => {
    it("deletes local APK files from public/uploads/apk", async () => {
      repositoryMocks.findById.mockResolvedValueOnce({
        ...baseVersion,
        apkUrl: "/uploads/apk/netmanager_v1.0.54.apk",
      });

      await service.deleteVersion(baseVersion.id);

      expect(mockUnlink).toHaveBeenCalledTimes(1);
      expect(mockUnlink.mock.calls[0]?.[0]).toContain("public");
      expect(mockUnlink.mock.calls[0]?.[0]).toContain(
        "uploads/apk/netmanager_v1.0.54.apk",
      );
      expect(mockDeleteFromR2).not.toHaveBeenCalled();
      expect(repositoryMocks.delete).toHaveBeenCalledWith(baseVersion.id);
    });

    it("deletes R2 APK objects using extracted key", async () => {
      mockDeleteFromR2.mockResolvedValueOnce(true);
      repositoryMocks.findById.mockResolvedValueOnce({
        ...baseVersion,
        apkUrl: "https://cdn.example.com/uploads/apk/netmanager_v1.0.54.apk",
      });

      await service.deleteVersion(baseVersion.id);

      expect(mockDeleteFromR2).toHaveBeenCalledWith(
        "uploads/apk/netmanager_v1.0.54.apk",
      );
      expect(mockUnlink).not.toHaveBeenCalled();
      expect(repositoryMocks.delete).toHaveBeenCalledWith(baseVersion.id);
    });
  });
});
