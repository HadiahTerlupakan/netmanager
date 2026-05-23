import { z } from "zod";

export const heroSchema = z.object({
  badge: z.string().max(100).nullable().optional(),
  title: z.string().min(1).max(200),
  highlight: z.string().max(100).nullable().optional(),
  subtitle: z.string().min(1).max(500),
  ctaPrimary: z.string().min(1).max(50),
  ctaSecondary: z.string().min(1).max(50),
  ctaLink: z.string().min(1).max(200),
  logoUrl: z.string().max(500).nullable().optional(),
});

export const featureSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(300),
  icon: z.string().min(1).max(50),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const pricingSchema = z.object({
  name: z.string().min(1).max(50),
  price: z.string().min(1).max(50),
  period: z.string().max(20).optional(),
  description: z.string().max(200).nullable().optional(),
  features: z.array(z.string()),
  isPopular: z.boolean().optional(),
  ctaText: z.string().min(1).max(50).optional(),
  ctaLink: z.string().min(1).max(200).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const testimonialSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(100),
  content: z.string().min(1).max(500),
  rating: z.number().int().min(1).max(5).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const faqSchema = z.object({
  question: z.string().min(1).max(200),
  answer: z.string().min(1).max(1000),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const footerSchema = z.object({
  companyName: z.string().min(1).max(100),
  description: z.string().max(300).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  links: z.record(
    z.string(),
    z.array(z.object({ label: z.string(), href: z.string() })),
  ),
  socials: z.record(z.string(), z.string()).nullable().optional(),
  logoUrl: z.string().max(500).nullable().optional(),
});
