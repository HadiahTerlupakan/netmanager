-- CreateEnum
CREATE TYPE "PresurveiJenisProspek" AS ENUM ('CALON_PELANGGAN', 'PERANTARA');

-- AlterTable
ALTER TABLE "presurvei_prospek" ADD COLUMN     "jenis" "PresurveiJenisProspek" NOT NULL DEFAULT 'CALON_PELANGGAN',
ADD COLUMN     "peran" TEXT;
