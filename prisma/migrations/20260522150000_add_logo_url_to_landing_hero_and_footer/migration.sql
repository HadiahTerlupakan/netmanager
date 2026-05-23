-- Add logoUrl column to LandingHero (for navbar logo)
ALTER TABLE "LandingHero" ADD COLUMN "logoUrl" TEXT;

-- Add logoUrl column to LandingFooter (for footer logo)
ALTER TABLE "LandingFooter" ADD COLUMN "logoUrl" TEXT;
