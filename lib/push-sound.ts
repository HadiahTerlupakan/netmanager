/**
 * Nada notifikasi yang dikirim bersama aplikasi mobile, menggantikan bunyi
 * bawaan perangkat, untuk push lewat FCM maupun Expo. Asetnya ada di repo
 * mobile pada `assets/sounds/notif_soft.wav` dan disalin ke kedua platform
 * saat prebuild. Pemasangan yang belum memilikinya jatuh kembali ke bunyi
 * bawaan; tidak ada notifikasi yang hilang karenanya.
 */

/** iOS menyebut berkasnya lengkap dengan ekstensi. */
export const PUSH_SOUND_IOS = "notif_soft.wav";

/** Android merujuk berkas di res/raw tanpa ekstensi. */
export const PUSH_SOUND_ANDROID = "notif_soft";
