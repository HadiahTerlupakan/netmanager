export interface LandingHero {
  id: string;
  badge: string | null;
  title: string;
  highlight: string | null;
  subtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  ctaLink: string;
  logoUrl: string | null;
  isActive: boolean;
}

export interface LandingFeature {
  id: string;
  title: string;
  description: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
}

export interface LandingPricing {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string | null;
  features: string[];
  isPopular: boolean;
  ctaText: string;
  ctaLink: string;
  sortOrder: number;
  isActive: boolean;
}

export interface LandingTestimonial {
  id: string;
  name: string;
  role: string;
  content: string;
  rating: number;
  sortOrder: number;
  isActive: boolean;
}

export interface LandingFaq {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
}

export interface LandingFooter {
  id: string;
  companyName: string;
  description: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  links: Record<string, Array<{ label: string; href: string }>>;
  socials: Record<string, string> | null;
  logoUrl: string | null;
  isActive: boolean;
}

export interface LandingContentAll {
  hero: LandingHero | null;
  features: LandingFeature[];
  pricing: LandingPricing[];
  testimonials: LandingTestimonial[];
  faq: LandingFaq[];
  footer: LandingFooter | null;
}
