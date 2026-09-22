# Desain UI Admin Presurvei (Fase 3)

**Status:** Disetujui untuk direncanakan · 2026-09-22
**Spec induk:** `docs/architecture/presurvei-module-design.md`
**Fase sebelumnya:** Fase 1 & 2 selesai — domain, repository, service, API, dan RBAC lengkap.

Modul presurvei sudah berfungsi penuh lewat API, tapi belum punya satu layar pun.
Dokumen ini merancang lapisan UI admin web yang memakainya.

---

## 1. Tujuan

Permintaan asli pemilik produk: *"saya ingin tracking para sales saya untuk survey atau
visit jualan kemana saja dan apa saja hasilnya, agar jelas dan dapat diketahui apa saja
kegiatan para sales atau marketing saya baik di kantor dengan ads maupun di lapangan
dengan walk in."*

Dua kata di situ menentukan desainnya. **"Kemana saja"** menuntut peta, bukan hanya daftar
alamat. **"Di kantor dengan ads"** berarti sebagian pemakai tidak memegang aplikasi mobile
sama sekali, sehingga web harus bisa mencatat, bukan sekadar memantau.

## 2. Yang dibangun

Enam layar di bawah `/admin/presurvei`, tersebar pada delapan route:

| Route | Isi |
|---|---|
| `/admin/presurvei` | Dashboard: KPI corong, kegiatan terkini, ringkas pencapaian |
| `/admin/presurvei/kegiatan` | Daftar kegiatan + tab peta kunjungan |
| `/admin/presurvei/kegiatan/[id]` | Detail: foto, data teknis, titik lokasi |
| `/admin/presurvei/prospek` | Papan kanban corong prospek |
| `/admin/presurvei/iklan` | Daftar kampanye iklan |
| `/admin/presurvei/iklan/new`, `/admin/presurvei/iklan/[id]/edit` | Form kampanye |
| `/admin/presurvei/target` | Target sales per periode |
| `/admin/presurvei/laporan` | Laporan pencapaian |

**Prospek dan kegiatan dibuat serta disunting lewat modal**, bukan halaman tersendiri.
Untuk prospek alasannya alur kerja: menavigasi keluar dari papan kanban lalu kembali memutus
konteks dan menghilangkan posisi guliran. Untuk kegiatan alasannya bentuk data — form web-nya
jauh lebih ringkas daripada versi mobile.

**Batas form kegiatan di web.** Kegiatan yang dicatat dari web mencakup jenis, waktu, hasil,
alamat yang dikunjungi, orang yang ditemui, catatan, dan data teknis. Ia **tidak** mencakup
foto maupun penangkapan koordinat GPS — keduanya lahir dari perangkat di lapangan, dan
memalsukannya dari kursi kantor justru merusak arti peta kunjungan. Kegiatan yang dibuat dari
web karenanya tidak muncul sebagai penanda di peta, dan itu perilaku yang benar: ia memang
tidak terjadi di suatu titik.

Iklan memakai halaman terpisah, mengikuti preseden `app/admin/marketing/canvasing/`, karena
formnya memuat rentang tanggal dan anggaran yang tidak nyaman di dalam modal.

## 3. Prasyarat yang belum ada

Empat hal harus dibangun sebelum halaman pertama bisa ditulis.

**`modules/presurvei/client.ts`** — barrel aman-klien. Delapan modul lain sudah punya
(`attendance`, `finance`, `marketing`, `planning`, …). Isinya hanya schema Zod, tipe, dan
konstanta; **tidak** service atau repository, supaya mengimpornya dari komponen klien tidak
menyeret Prisma, `pg`, dan `tls` ke bundle browser. Tiru `modules/planning/client.ts`.

**Registrasi menu** di tiga berkas: blok `PRESURVEI` beserta enam anaknya di
`lib/menu-config.ts` (tiru blok Marketing), entri modul di `lib/feature-modules.ts` supaya
bisa dimatikan per-tenant, dan `specialMappings` di
`components/layout/admin-sidebar/adminSidebarMenu.ts`.

**Setiap sub-menu memetakan ke resource permission-nya sendiri, bukan satu resource bersama.**
Ini berbeda dari pola `PLANNING.*` yang memetakan seluruh anak ke satu resource, dan
perbedaannya disengaja: presurvei memakai empat resource berbeda dengan pemegang yang berbeda.

| Menu | Resource | Permission yang dicek |
|---|---|---|
| `PRESURVEI` (induk), `PRESURVEI.KEGIATAN`, `PRESURVEI.PROSPEK` | `presurvei` | `presurvei:read` |
| `PRESURVEI.IKLAN` | `presurvei_iklan` | `presurvei_iklan:read` |
| `PRESURVEI.TARGET` | `presurvei_target` | `presurvei_target:read` |
| `PRESURVEI.LAPORAN` | `presurvei_laporan` | `presurvei_laporan:read` |

Memetakan semuanya ke `presurvei` akan menampilkan menu Iklan kepada orang yang tidak punya
`presurvei_iklan:read`, lalu menyambutnya dengan 403 setelah diklik — menu yang mengecoh lebih
buruk daripada menu yang tidak ada.

**`modules/presurvei/utils/statusConfig.ts`** — label dan warna untuk `PROSPEK_STATUSES`,
`KEGIATAN_JENIS`, `KEGIATAN_HASIL`, `PROSPEK_SUMBER`, dan `IKLAN_CHANNELS`. Komponen
`components/common/StatusBadge.tsx` memakai union status yang di-hardcode dan tidak memuat
enum presurvei; memaksakannya ke sana akan merusak modul lain. Preseden:
`modules/planning/utils/statusConfig.ts`.

**Koordinat di `KegiatanListItemDto`** — satu-satunya perubahan backend di fase ini.
`latitude` dan `longitude` saat ini hanya ada di DTO detail. Peta membutuhkannya di daftar;
mengambilnya per-baris lewat endpoint detail akan melahirkan N+1.

## 4. Pola teknis

Seluruhnya mengikuti konvensi yang sudah terbukti di repo. Tidak ada yang baru diperkenalkan.

**Pengambilan data.** `useQuery` langsung dengan `placeholderData: keepPreviousData` untuk
daftar berfilter — tiru `app/admin/marketing/canvasing/useCanvasingListQuery.ts`, termasuk
query key eksplisit yang memuat seluruh filter. `useApi` (`lib/hooks/useApi.ts`) untuk GET
sederhana seperti detail dan lookup.

Mutasi yang mengubah modul lain wajib meng-invalidate query modul itu. Konversi prospek →
canvasing **harus** meng-invalidate daftar canvasing; tambahkan helper ke
`lib/hooks/useInvalidate.ts` mengikuti `useInvalidatePlanningRelated`.

**Form.** `useState` + Zod `.safeParse()` saat submit, schema dipakai ulang dari
`modules/presurvei/client.ts`. **Bukan** react-hook-form — pola itu hanya ada di modul
`mitra` dan tidak pernah menyebar; modul terbaru yang dibangun utuh (Planning, Agustus 2026)
justru kembali ke pola ini.

**Tabel.** `components/ui/ResponsiveTable.tsx` dengan paginasi bawaannya. Ia menurunkan
tampilan kartu mobile dari definisi kolom yang sama, jadi tidak perlu komponen mobile
terpisah.

**State filter.** State React lokal, bukan query parameter URL. Ini konvensi repo tanpa
pengecualian — nol berkas admin memakai `useSearchParams`. Konsekuensinya diketahui: filter
hilang saat reload dan tidak bisa dibagikan lewat tautan. Fase 3 tidak mengubah konvensi ini;
mengubahnya adalah keputusan tersendiri yang menyentuh seluruh admin.

**Notifikasi.** `react-hot-toast` (`toast.success`/`toast.error`), sudah terpasang global.

**Komponen bersama.** `components/common/StatCard.tsx` untuk KPI,
`components/common/ConfirmDialog.tsx` untuk konfirmasi, `components/ui/Modal.tsx`,
`components/ui/EmptyState.tsx`, `components/ui/LoadingSkeleton.tsx`.

## 5. Papan prospek

Bagian paling kompleks, dan satu-satunya yang menuntut interaksi non-sepele.

**Kolom.** Lima kolom corong hidup selalu tampil: BARU, DIHUBUNGI, TERTARIK, NEGOSIASI,
DEAL. TIDAK_MINAT dan TIDAK_LAYAK disembunyikan di balik sakelar. Tujuh kolom sekaligus
menuntut geser horizontal di layar biasa, dan dua kolom mati akan tumbuh tanpa batas sampai
menenggelamkan corong kerjanya.

**Aturan seret diambil dari domain, bukan ditulis ulang di UI.**
`getStatusLanjutan(status)` sudah diekspor dari `modules/presurvei` dan mengembalikan salinan
daftar tujuan yang sah. Saat kartu diangkat, hanya kolom tujuan itu yang menyala; sisanya
diredupkan dan menolak jatuhan.

Ini penting bukan sekadar demi kenyamanan: tanpa pembatasan, mayoritas seretan akan ditolak
server dan pemakai belajar mengabaikan pesan error.

**DEAL istimewa.** Menjatuhkan kartu ke DEAL tidak mengubah status langsung — ia membuka form
konversi, karena promosi ke Canvasing menuntut nomor KTP dan paket yang tidak ada di prospek.
Setelah berhasil, kartu pindah ke DEAL dan daftar canvasing ikut di-invalidate.

**Implementasi seret** memakai HTML5 drag-drop native, mengikuti
`app/admin/planning/PlanningKanbanClient.tsx` yang sudah berjalan di repo ini. Tidak ada
pustaka drag-drop baru yang ditambahkan.

## 6. Peta kunjungan

Tab kedua pada halaman kegiatan, berdampingan dengan daftarnya — bukan halaman terpisah,
supaya filter yang sama berlaku untuk keduanya.

**Repo ini memakai dua pustaka peta untuk tujuan berbeda, dan peta kunjungan mengikuti yang
kedua.** `react-leaflet` dipakai `components/map/*` untuk topologi jaringan — jalur fiber,
overlay gambar, lapisan interaktif. **OpenLayers** (`ol`) dipakai untuk peta titik:
`components/attendance/EmployeeLocationMap.tsx` menggambar banyak lokasi orang dengan popup,
dan `components/common/MapPicker.tsx` memilih satu titik.

Peta kunjungan berbentuk sama persis dengan yang pertama — banyak titik, diwarnai, bisa
diklik. Ia mengikuti pola `EmployeeLocationMap`, bukan memperkenalkan react-leaflet ke jenis
peta yang sudah punya preseden OpenLayers.

Komponennya dimuat lewat `dynamic(..., { ssr: false })` seperti
`app/admin/kehadiran/live-map/LiveMapClient.tsx:24` — pustaka peta menyentuh `window` saat
modul dimuat dan akan menggagalkan render di server tanpa itu.

Penanda diwarnai menurut `hasil` kegiatan memakai `statusConfig.ts` yang sama dengan badge,
sehingga warna di peta dan di daftar tidak pernah berbeda arti. Mengklik penanda membuka
panel ringkas dengan tautan ke halaman detail.

Kegiatan tanpa koordinat — walk-in kantor, panggilan telepon — tidak muncul di peta. Jumlah
yang tersembunyi ditampilkan sebagai keterangan, supaya pemakai tidak salah menyimpulkan
timnya kurang bergerak.

## 7. Laporan pencapaian

Tabel sales × tiga metrik (kunjungan, prospek baru, konversi), masing-masing menampilkan
target, tercapai, dan persentase. Bilah kemajuan dibatasi 100% untuk tampilan, tapi **angka
sebenarnya tetap ditampilkan** — manajer perlu melihat 40 kunjungan dari target 20, bukan
sekadar "100%".

Pemilih periode berupa bulan dan tahun. Dua keterbatasan yang diwarisi dari Fase 2 dan harus
terlihat di layar, bukan disembunyikan:

- Sales yang punya realisasi tapi **belum ditetapkan target** tidak muncul, karena laporan
  digerakkan daftar target. Halaman harus menyatakan ini, bukan membiarkan manajer mengira
  timnya lebih kecil dari kenyataan.
- Batas periode memakai UTC, bukan timezone tenant. Aktivitas pada tujuh jam pertama tiap
  bulan terhitung di bulan sebelumnya.

## 8. Dashboard

Pintu masuk menu. Kartu KPI: jumlah prospek per status corong, kegiatan tujuh hari terakhir,
dan ringkasan pencapaian **bulan berjalan** — bulan kalender saat halaman dibuka, bukan
rentang bergulir. Daftar pendek kegiatan terbaru dan prospek yang belum punya pemilik.

Prospek tak bertuan layak ditonjolkan: ia lahir ketika form publik masuk dan tenant belum
punya sales aktif, dan tanpa tempat yang menampilkannya ia tidak akan pernah ditemukan.

## 9. Pengujian

Repo ini **tidak memakai testing-library maupun DOM palsu**. Ke-31 test komponennya memakai
`renderToStaticMarkup` dari `react-dom/server`, atau memalsukan komponen anak dengan
`vi.mock` lalu memeriksa props yang diteruskan kepadanya — lihat
`tests/ui/restock-table.test.tsx`.

**Ini membentuk arsitekturnya, bukan sekadar membatasi pengujiannya.** Interaksi seret tidak
dapat diuji sama sekali dengan perkakas yang ada. Maka logikanya tidak boleh tinggal di dalam
komponen:

- Penentuan kolom tujuan yang sah → fungsi murni, diuji langsung.
- Pemetaan status ke label dan warna → `statusConfig.ts`, diuji langsung.
- Pembentukan query dari filter → fungsi murni, diuji langsung.
- Perhitungan dan pembatasan persentase → sudah ada di domain Fase 2, dipakai ulang.

Komponen dibuat setipis mungkin dan diuji lewat props yang ia teruskan ke `ResponsiveTable`,
`StatCard`, dan sejenisnya.

Kelas cacat yang berulang sepanjang Fase 2 dan harus dijaga di sini: assertion yang hanya
memastikan sesuatu terpanggil tanpa memeriksa argumennya, nilai kembar pada field bersebelahan
bertipe sama sehingga tertukarnya tak terlihat, dan `||` di tempat nilai `0` sah.

## 10. Di luar cakupan

Fase 4 (mobile sales) tidak disentuh. Laporan per-iklan — biaya per lead, ROI kampanye —
tidak dibangun: datanya sudah dikumpulkan Fase 2 lewat `iklanId`, tapi belum ada konsumen,
dan saat dibangun nanti ia wajib sadar-periode agar kampanye yang sudah mati tidak
menggelembungkan hasilnya.

Penegakan `site_only` tetap ditarik seperti keputusan Fase 1.
