-- @safe-guard-ack: Menghapus tabel push_subscriptions legacy setelah migrasi FCM-only selesai agar skema web-push lama tidak tertinggal.
DROP TABLE IF EXISTS "push_subscriptions";
