# Nada notifikasi

`notification.wav` adalah nada notifikasi bawaan admin dan portal pelanggan,
dirujuk lewat `NOTIFICATION_SOUND_SRC` di `lib/notification-sound.ts`.

Berkasnya salinan `assets/sounds/notif_soft.wav` dari repo mobile-netmanager,
yang disintesis oleh `scripts/generate-notification-sound.py` di sana, supaya
satu notifikasi terdengar sama di aplikasi dan di browser. Untuk mengganti
nada, ubah skrip itu, jalankan, lalu salin hasilnya ke sini.

Admin bisa memakai nada sendiri lewat Pengaturan → Nada Dering; pilihan itu
disimpan per browser dan tidak mengubah berkas ini.
