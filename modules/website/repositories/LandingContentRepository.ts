import { prisma } from "@/modules/database";

export class LandingContentRepository {
  /** Get active hero section */
  async getHero() {
    return prisma.landingHero.findFirst({ where: { isActive: true } });
  }

  /** Upsert hero — only one hero record is expected */
  async upsertHero(data: {
    badge?: string | null;
    title: string;
    highlight?: string | null;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    ctaLink: string;
    logoUrl?: string | null;
  }) {
    const existing = await prisma.landingHero.findFirst();
    if (existing) {
      return prisma.landingHero.update({ where: { id: existing.id }, data });
    }
    return prisma.landingHero.create({ data });
  }

  /** Get active features ordered by sortOrder */
  async getFeatures() {
    return prisma.landingFeature.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  /** Get all features (including inactive) ordered by sortOrder */
  async getAllFeatures() {
    return prisma.landingFeature.findMany({ orderBy: { sortOrder: "asc" } });
  }

  /** Create a new feature */
  async createFeature(data: {
    title: string;
    description: string;
    icon: string;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    return prisma.landingFeature.create({ data });
  }

  /** Update an existing feature by id */
  async updateFeature(
    id: string,
    data: Partial<{
      title: string;
      description: string;
      icon: string;
      sortOrder: number;
      isActive: boolean;
    }>,
  ) {
    return prisma.landingFeature.update({ where: { id }, data });
  }

  /** Delete a feature by id */
  async deleteFeature(id: string) {
    return prisma.landingFeature.delete({ where: { id } });
  }

  /** Get active pricing plans ordered by sortOrder */
  async getPricing() {
    return prisma.landingPricing.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  /** Get all pricing plans (including inactive) ordered by sortOrder */
  async getAllPricing() {
    return prisma.landingPricing.findMany({ orderBy: { sortOrder: "asc" } });
  }

  /** Create a new pricing plan */
  async createPricing(data: {
    name: string;
    price: string;
    period?: string;
    description?: string | null;
    features: unknown;
    isPopular?: boolean;
    ctaText?: string;
    ctaLink?: string;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    return prisma.landingPricing.create({
      data: data as Parameters<typeof prisma.landingPricing.create>[0]["data"],
    });
  }

  /** Update an existing pricing plan by id */
  async updatePricing(
    id: string,
    data: Partial<{
      name: string;
      price: string;
      period: string;
      description: string | null;
      features: unknown;
      isPopular: boolean;
      ctaText: string;
      ctaLink: string;
      sortOrder: number;
      isActive: boolean;
    }>,
  ) {
    return prisma.landingPricing.update({
      where: { id },
      data: data as Parameters<typeof prisma.landingPricing.update>[0]["data"],
    });
  }

  /** Delete a pricing plan by id */
  async deletePricing(id: string) {
    return prisma.landingPricing.delete({ where: { id } });
  }

  /** Get active testimonials ordered by sortOrder */
  async getTestimonials() {
    return prisma.landingTestimonial.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  /** Get all testimonials (including inactive) ordered by sortOrder */
  async getAllTestimonials() {
    return prisma.landingTestimonial.findMany({
      orderBy: { sortOrder: "asc" },
    });
  }

  /** Create a new testimonial */
  async createTestimonial(data: {
    name: string;
    role: string;
    content: string;
    rating?: number;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    return prisma.landingTestimonial.create({ data });
  }

  /** Update an existing testimonial by id */
  async updateTestimonial(
    id: string,
    data: Partial<{
      name: string;
      role: string;
      content: string;
      rating: number;
      sortOrder: number;
      isActive: boolean;
    }>,
  ) {
    return prisma.landingTestimonial.update({ where: { id }, data });
  }

  /** Delete a testimonial by id */
  async deleteTestimonial(id: string) {
    return prisma.landingTestimonial.delete({ where: { id } });
  }

  /** Get active FAQ entries ordered by sortOrder */
  async getFaq() {
    return prisma.landingFaq.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  /** Get all FAQ entries (including inactive) ordered by sortOrder */
  async getAllFaq() {
    return prisma.landingFaq.findMany({ orderBy: { sortOrder: "asc" } });
  }

  /** Create a new FAQ entry */
  async createFaq(data: {
    question: string;
    answer: string;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    return prisma.landingFaq.create({ data });
  }

  /** Update an existing FAQ entry by id */
  async updateFaq(
    id: string,
    data: Partial<{
      question: string;
      answer: string;
      sortOrder: number;
      isActive: boolean;
    }>,
  ) {
    return prisma.landingFaq.update({ where: { id }, data });
  }

  /** Delete a FAQ entry by id */
  async deleteFaq(id: string) {
    return prisma.landingFaq.delete({ where: { id } });
  }

  /** Get active footer content */
  async getFooter() {
    return prisma.landingFooter.findFirst({ where: { isActive: true } });
  }

  /** Upsert footer — only one footer record is expected */
  async upsertFooter(data: {
    companyName: string;
    description?: string | null;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    links: Record<string, Array<{ label: string; href: string }>>;
    socials?: Record<string, string> | null;
    logoUrl?: string | null;
  }) {
    const existing = await prisma.landingFooter.findFirst();
    if (existing) {
      return prisma.landingFooter.update({
        where: { id: existing.id },
        data: data as Parameters<typeof prisma.landingFooter.update>[0]["data"],
      });
    }
    return prisma.landingFooter.create({
      data: data as Parameters<typeof prisma.landingFooter.create>[0]["data"],
    });
  }

  /** Fetch all active landing content sections in parallel */
  async getAllContent() {
    const [hero, features, pricing, testimonials, faq, footer] =
      await Promise.all([
        this.getHero(),
        this.getFeatures(),
        this.getPricing(),
        this.getTestimonials(),
        this.getFaq(),
        this.getFooter(),
      ]);
    return { hero, features, pricing, testimonials, faq, footer };
  }
}
