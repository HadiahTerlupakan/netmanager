# Attendance Cache Hardening Design

> Scope kecil untuk Paket 4: hardening cache attendance agar Redis menjadi best-effort dependency, bukan hard dependency pada read path attendance.

## Goal
Menjaga alur attendance tetap berjalan saat Redis gagal pada timezone cache, holiday cache, schedule cache, dan invalidation settings.

## Design
- AttendanceTimezoneService: fallback ke repository bila `redis.get` gagal, dan `setex`/`del` hanya best-effort dengan logging.
- HolidayRepository: fallback ke DB bila `redis.get` gagal, dan cache write/invalidation tidak boleh menggagalkan operasi bisnis.
- AttendanceService: cache `user:schedule:${userId}` menjadi best-effort; bila Redis gagal, tetap ambil dari DB.
- Settings general route: invalidasi cache timezone dijalankan eksplisit tanpa fire-and-forget silent swallow; kegagalan invalidasi tidak menggagalkan update settings.

## Testing
- Tambah test RED untuk fallback Redis pada AttendanceTimezoneService.
- Tambah test RED untuk fallback Redis pada HolidayRepository.
- Tambah test RED untuk fallback Redis pada AttendanceService check-in schedule lookup.
- Tambah test RED untuk route settings general yang tetap sukses walau invalidasi cache attendance gagal.
