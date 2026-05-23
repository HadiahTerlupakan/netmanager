import { describe, expect, it } from "vitest";
import {
  heroSchema,
  footerSchema,
  featureSchema,
  pricingSchema,
  testimonialSchema,
  faqSchema,
} from "../../../modules/website/validators/landing-content.validator";

describe("landing-content validators", () => {
  describe("heroSchema", () => {
    const validHero = {
      title: "Title",
      subtitle: "Subtitle",
      ctaPrimary: "Mulai",
      ctaSecondary: "Demo",
      ctaLink: "/login",
    };

    it("accepts minimum required fields", () => {
      expect(heroSchema.safeParse(validHero).success).toBe(true);
    });

    it("accepts logoUrl when provided", () => {
      const result = heroSchema.safeParse({
        ...validHero,
        logoUrl: "/uploads/landing-logo/logo.webp",
      });
      expect(result.success).toBe(true);
    });

    it("accepts null logoUrl", () => {
      const result = heroSchema.safeParse({ ...validHero, logoUrl: null });
      expect(result.success).toBe(true);
    });

    it("accepts missing logoUrl (optional)", () => {
      expect(heroSchema.safeParse(validHero).success).toBe(true);
    });

    it("rejects logoUrl exceeding 500 chars", () => {
      const result = heroSchema.safeParse({
        ...validHero,
        logoUrl: "/uploads/" + "a".repeat(500),
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty title", () => {
      const result = heroSchema.safeParse({ ...validHero, title: "" });
      expect(result.success).toBe(false);
    });

    it("rejects title exceeding 200 chars", () => {
      const result = heroSchema.safeParse({
        ...validHero,
        title: "a".repeat(201),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("footerSchema", () => {
    const validFooter = {
      companyName: "RADPRO.ID",
      links: {
        produk: [{ label: "Fitur", href: "#features" }],
      },
    };

    it("accepts minimum required fields", () => {
      expect(footerSchema.safeParse(validFooter).success).toBe(true);
    });

    it("accepts logoUrl when provided", () => {
      const result = footerSchema.safeParse({
        ...validFooter,
        logoUrl: "/uploads/landing-logo/footer.webp",
      });
      expect(result.success).toBe(true);
    });

    it("accepts null logoUrl", () => {
      const result = footerSchema.safeParse({ ...validFooter, logoUrl: null });
      expect(result.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const result = footerSchema.safeParse({
        ...validFooter,
        email: "not-an-email",
      });
      expect(result.success).toBe(false);
    });

    it("accepts socials map", () => {
      const result = footerSchema.safeParse({
        ...validFooter,
        socials: { twitter: "https://twitter.com/radpro" },
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty companyName", () => {
      const result = footerSchema.safeParse({
        ...validFooter,
        companyName: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("featureSchema", () => {
    it("accepts valid feature", () => {
      const result = featureSchema.safeParse({
        title: "Billing",
        description: "Auto billing",
        icon: "MdReceiptLong",
      });
      expect(result.success).toBe(true);
    });

    it("rejects icon name exceeding 50 chars", () => {
      const result = featureSchema.safeParse({
        title: "Billing",
        description: "Auto billing",
        icon: "a".repeat(51),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("pricingSchema", () => {
    it("accepts valid pricing with features array", () => {
      const result = pricingSchema.safeParse({
        name: "Pro",
        price: "299000",
        features: ["Unlimited customers", "API access"],
      });
      expect(result.success).toBe(true);
    });

    it("rejects pricing without features", () => {
      const result = pricingSchema.safeParse({
        name: "Pro",
        price: "299000",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("testimonialSchema", () => {
    it("accepts valid testimonial", () => {
      const result = testimonialSchema.safeParse({
        name: "John",
        role: "CEO",
        content: "Great product",
        rating: 5,
      });
      expect(result.success).toBe(true);
    });

    it("rejects rating > 5", () => {
      const result = testimonialSchema.safeParse({
        name: "John",
        role: "CEO",
        content: "Great",
        rating: 6,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("faqSchema", () => {
    it("accepts valid faq", () => {
      const result = faqSchema.safeParse({
        question: "Apa itu RADPRO?",
        answer: "Platform manajemen ISP all-in-one.",
      });
      expect(result.success).toBe(true);
    });

    it("rejects answer exceeding 1000 chars", () => {
      const result = faqSchema.safeParse({
        question: "Q?",
        answer: "a".repeat(1001),
      });
      expect(result.success).toBe(false);
    });
  });
});
