import { LandingContentRepository } from "../repositories/LandingContentRepository";

/** Service layer for landing page content management */
export class LandingContentService {
  private repository: LandingContentRepository;

  constructor() {
    this.repository = new LandingContentRepository();
  }

  /** Get active hero section */
  getHero() {
    return this.repository.getHero();
  }

  /** Upsert hero section */
  upsertHero(data: Parameters<LandingContentRepository["upsertHero"]>[0]) {
    return this.repository.upsertHero(data);
  }

  /** Get all features (including inactive) for admin management */
  getFeatures() {
    return this.repository.getAllFeatures();
  }

  /** Get only active features for public display */
  getActiveFeatures() {
    return this.repository.getFeatures();
  }

  /** Create a new feature */
  createFeature(
    data: Parameters<LandingContentRepository["createFeature"]>[0],
  ) {
    return this.repository.createFeature(data);
  }

  /** Update an existing feature */
  updateFeature(
    id: string,
    data: Parameters<LandingContentRepository["updateFeature"]>[1],
  ) {
    return this.repository.updateFeature(id, data);
  }

  /** Delete a feature */
  deleteFeature(id: string) {
    return this.repository.deleteFeature(id);
  }

  /** Get all pricing plans (including inactive) for admin management */
  getPricing() {
    return this.repository.getAllPricing();
  }

  /** Get only active pricing plans for public display */
  getActivePricing() {
    return this.repository.getPricing();
  }

  /** Create a new pricing plan */
  createPricing(
    data: Parameters<LandingContentRepository["createPricing"]>[0],
  ) {
    return this.repository.createPricing(data);
  }

  /** Update an existing pricing plan */
  updatePricing(
    id: string,
    data: Parameters<LandingContentRepository["updatePricing"]>[1],
  ) {
    return this.repository.updatePricing(id, data);
  }

  /** Delete a pricing plan */
  deletePricing(id: string) {
    return this.repository.deletePricing(id);
  }

  /** Get all testimonials (including inactive) for admin management */
  getTestimonials() {
    return this.repository.getAllTestimonials();
  }

  /** Get only active testimonials for public display */
  getActiveTestimonials() {
    return this.repository.getTestimonials();
  }

  /** Create a new testimonial */
  createTestimonial(
    data: Parameters<LandingContentRepository["createTestimonial"]>[0],
  ) {
    return this.repository.createTestimonial(data);
  }

  /** Update an existing testimonial */
  updateTestimonial(
    id: string,
    data: Parameters<LandingContentRepository["updateTestimonial"]>[1],
  ) {
    return this.repository.updateTestimonial(id, data);
  }

  /** Delete a testimonial */
  deleteTestimonial(id: string) {
    return this.repository.deleteTestimonial(id);
  }

  /** Get all FAQ entries (including inactive) for admin management */
  getFaq() {
    return this.repository.getAllFaq();
  }

  /** Get only active FAQ entries for public display */
  getActiveFaq() {
    return this.repository.getFaq();
  }

  /** Create a new FAQ entry */
  createFaq(data: Parameters<LandingContentRepository["createFaq"]>[0]) {
    return this.repository.createFaq(data);
  }

  /** Update an existing FAQ entry */
  updateFaq(
    id: string,
    data: Parameters<LandingContentRepository["updateFaq"]>[1],
  ) {
    return this.repository.updateFaq(id, data);
  }

  /** Delete a FAQ entry */
  deleteFaq(id: string) {
    return this.repository.deleteFaq(id);
  }

  /** Get active footer content */
  getFooter() {
    return this.repository.getFooter();
  }

  /** Upsert footer content */
  upsertFooter(data: Parameters<LandingContentRepository["upsertFooter"]>[0]) {
    return this.repository.upsertFooter(data);
  }

  /** Fetch all active landing content sections in parallel (for public page render) */
  getAllContent() {
    return this.repository.getAllContent();
  }
}
