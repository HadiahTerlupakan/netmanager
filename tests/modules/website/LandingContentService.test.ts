import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetHero = vi.fn();
const mockUpsertHero = vi.fn();
const mockGetFeatures = vi.fn();
const mockGetAllFeatures = vi.fn();
const mockCreateFeature = vi.fn();
const mockUpdateFeature = vi.fn();
const mockDeleteFeature = vi.fn();
const mockGetAllContent = vi.fn();
const mockGetFooter = vi.fn();
const mockUpsertFooter = vi.fn();

vi.mock(
  "../../../modules/website/repositories/LandingContentRepository",
  () => ({
    LandingContentRepository: class {
      getHero = mockGetHero;
      upsertHero = mockUpsertHero;
      getFeatures = mockGetFeatures;
      getAllFeatures = mockGetAllFeatures;
      createFeature = mockCreateFeature;
      updateFeature = mockUpdateFeature;
      deleteFeature = mockDeleteFeature;
      getAllContent = mockGetAllContent;
      getFooter = mockGetFooter;
      upsertFooter = mockUpsertFooter;
    },
  }),
);

import { LandingContentService } from "../../../modules/website/services/LandingContentService";

describe("LandingContentService", () => {
  let service: LandingContentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LandingContentService();
  });

  describe("hero", () => {
    it("getHero delegates to repository", async () => {
      mockGetHero.mockResolvedValue({ id: "1", title: "T", logoUrl: null });
      const result = await service.getHero();
      expect(mockGetHero).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ id: "1", title: "T", logoUrl: null });
    });

    it("upsertHero passes logoUrl through", async () => {
      mockUpsertHero.mockResolvedValue({ id: "1" });
      await service.upsertHero({
        title: "T",
        subtitle: "S",
        ctaPrimary: "A",
        ctaSecondary: "B",
        ctaLink: "/x",
        logoUrl: "/uploads/landing-logo/x.webp",
      });
      expect(mockUpsertHero).toHaveBeenCalledWith(
        expect.objectContaining({ logoUrl: "/uploads/landing-logo/x.webp" }),
      );
    });
  });

  describe("features (admin vs public)", () => {
    it("getFeatures returns ALL (including inactive)", async () => {
      mockGetAllFeatures.mockResolvedValue([{ id: "1", isActive: false }]);
      await service.getFeatures();
      expect(mockGetAllFeatures).toHaveBeenCalledTimes(1);
      expect(mockGetFeatures).not.toHaveBeenCalled();
    });

    it("getActiveFeatures returns only active", async () => {
      mockGetFeatures.mockResolvedValue([{ id: "1", isActive: true }]);
      await service.getActiveFeatures();
      expect(mockGetFeatures).toHaveBeenCalledTimes(1);
      expect(mockGetAllFeatures).not.toHaveBeenCalled();
    });
  });

  describe("getAllContent (mapping)", () => {
    it("maps pricing.features JsonValue to string[]", async () => {
      mockGetAllContent.mockResolvedValue({
        hero: null,
        features: [],
        pricing: [
          { id: "p1", features: ["A", "B"] },
          { id: "p2", features: null },
        ],
        testimonials: [],
        faq: [],
        footer: null,
      });
      const result = await service.getAllContent();
      expect(result.pricing[0].features).toEqual(["A", "B"]);
      expect(result.pricing[1].features).toEqual([]);
    });

    it("maps footer links/socials JsonValue to typed records", async () => {
      mockGetAllContent.mockResolvedValue({
        hero: null,
        features: [],
        pricing: [],
        testimonials: [],
        faq: [],
        footer: {
          id: "f1",
          companyName: "X",
          links: { produk: [{ label: "L", href: "/h" }] },
          socials: { twitter: "https://t" },
          logoUrl: "/uploads/logo.webp",
        },
      });
      const result = await service.getAllContent();
      expect(result.footer?.links).toEqual({
        produk: [{ label: "L", href: "/h" }],
      });
      expect(result.footer?.socials).toEqual({ twitter: "https://t" });
      expect(result.footer?.logoUrl).toBe("/uploads/logo.webp");
    });

    it("returns null footer when repository returns null", async () => {
      mockGetAllContent.mockResolvedValue({
        hero: null,
        features: [],
        pricing: [],
        testimonials: [],
        faq: [],
        footer: null,
      });
      const result = await service.getAllContent();
      expect(result.footer).toBeNull();
    });

    it("defaults footer.links to empty object when null", async () => {
      mockGetAllContent.mockResolvedValue({
        hero: null,
        features: [],
        pricing: [],
        testimonials: [],
        faq: [],
        footer: {
          id: "f1",
          companyName: "X",
          links: null,
          socials: null,
          logoUrl: null,
        },
      });
      const result = await service.getAllContent();
      expect(result.footer?.links).toEqual({});
      expect(result.footer?.socials).toBeNull();
    });
  });

  describe("footer", () => {
    it("upsertFooter passes logoUrl through", async () => {
      mockUpsertFooter.mockResolvedValue({ id: "1" });
      await service.upsertFooter({
        companyName: "X",
        links: {},
        logoUrl: "/uploads/landing-logo/footer.webp",
      });
      expect(mockUpsertFooter).toHaveBeenCalledWith(
        expect.objectContaining({
          logoUrl: "/uploads/landing-logo/footer.webp",
        }),
      );
    });
  });
});
