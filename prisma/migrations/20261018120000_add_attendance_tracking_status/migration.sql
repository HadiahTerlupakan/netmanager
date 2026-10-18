-- Status tracking lokasi yang dilaporkan aplikasi per sesi kerja (izin latar
-- belakang dicabut, GPS mati, ...). Kolom nullable tanpa default: hanya
-- metadata, aman untuk baris lama dan tidak mengunci tabel lama.
ALTER TABLE "Attendance" ADD COLUMN "trackingStatus" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "trackingStatusAt" TIMESTAMP(3);
