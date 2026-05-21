-- CreateTable
CREATE TABLE "LandingHero" (
    "id" TEXT NOT NULL,
    "badge" TEXT,
    "title" TEXT NOT NULL,
    "highlight" TEXT,
    "subtitle" TEXT NOT NULL,
    "ctaPrimary" TEXT NOT NULL DEFAULT 'Mulai Gratis 14 Hari',
    "ctaSecondary" TEXT NOT NULL DEFAULT 'Lihat Fitur',
    "ctaLink" TEXT NOT NULL DEFAULT '/admin/login',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LandingHero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingFeature" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LandingFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingPricing" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "period" TEXT NOT NULL DEFAULT '/bulan',
    "description" TEXT,
    "features" JSONB NOT NULL,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "ctaText" TEXT NOT NULL DEFAULT 'Mulai Sekarang',
    "ctaLink" TEXT NOT NULL DEFAULT '/admin/login',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LandingPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingTestimonial" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LandingTestimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingFaq" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LandingFaq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingFooter" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT 'RADPRO.ID',
    "description" TEXT,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "links" JSONB NOT NULL,
    "socials" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LandingFooter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LandingFeature_sortOrder_idx" ON "LandingFeature"("sortOrder");
CREATE INDEX "LandingPricing_sortOrder_idx" ON "LandingPricing"("sortOrder");
CREATE INDEX "LandingTestimonial_sortOrder_idx" ON "LandingTestimonial"("sortOrder");
CREATE INDEX "LandingFaq_sortOrder_idx" ON "LandingFaq"("sortOrder");
