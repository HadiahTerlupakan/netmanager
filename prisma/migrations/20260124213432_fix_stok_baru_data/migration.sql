-- Data Migration: Fix stokBaru untuk data lama yang belum termigrasi
-- 
-- Masalah: Data stok yang diinput sebelum fitur "stok per kondisi" diimplementasikan
-- memiliki stokBaru = 0 padahal total stok > (stokBekas + stokRusak)
--
-- Solusi: Set stokBaru = stok - stokBekas - stokRusak untuk record yang belum termigrasi

UPDATE barang_gudang 
SET "stokBaru" = GREATEST(0, stok - "stokBekas" - "stokRusak")
WHERE "stokBaru" = 0 
  AND stok > ("stokBekas" + "stokRusak");