-- Ketidakcocokan gateway yang sudah diteruskan ke staf keuangan untuk payment
-- ini, supaya penyapu checkout tidak menandai checkout yang sama tiap putaran.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "reviewFlag" TEXT;
