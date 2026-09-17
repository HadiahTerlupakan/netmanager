# Lessons

## 2026-05-12

### Persist plan ke dokumen proyek, jangan berhenti di chat
- Jika `CLAUDE.md` meminta plan ditulis ke `tasks/todo.md`, maka hasil planning wajib dipersist ke file tersebut, bukan hanya dijawab di percakapan.
- **Why:** Output chat saja tidak memenuhi workflow proyek dan membuat rencana tidak terdokumentasi di repo.
- **How to apply:** Setelah menyusun plan non-trivial, selalu cek/siapkan `tasks/` lalu tulis checklist plan ke `tasks/todo.md` dan review/lesson ke file pendukung yang relevan.

### Hormati larangan worktree di repo ini
- Jangan membuat atau memicu worktree/agent isolation untuk repo ini selama `CLAUDE.md` menyatakan perubahan harus dikerjakan langsung di repo utama.
- **Why:** User kerja sendiri dan ingin seluruh perubahan langsung terlihat di working tree aktif; worktree tambahan melanggar workflow proyek dan membingungkan status repo.
- **How to apply:** Untuk repo ini, kerjakan semua edit di working tree utama dan hindari delegasi agent dengan `isolation: "worktree"` atau tindakan lain yang membuat worktree baru.

## 2026-05-17

### Autonomy: putuskan sendiri, jangan banyak tanya
- `CLAUDE.md` Autonomy section: *"Never ask for confirmation before proceeding. Just execute. State what you're doing, then do it."*
- **Why:** User butuh agent yang action-oriented, bukan yang nanya tiap simpangan. Banyak tanya = waste turn + frustasi user. User memang butuh klarifikasi hanya saat info kritis missing atau interpretasi benar-benar opposite.
- **How to apply:** Saat ada pilihan, pilih yang paling logical autonomously dengan `[Asumsi: ...]`, lalu eksekusi. Jangan pakai `AskUserQuestion` untuk hal yang masih bisa diasumsikan dengan reasoning yang sound. Anti-pattern: "Stop sekarang atau lanjut?", "Pilih strategi mana?", "Mau eksekusi yang mana?" — itu pertanyaan yang seharusnya saya putuskan sendiri.

### Output Style: lead with action, jangan akhiri dengan pertanyaan
- `CLAUDE.md` Output Style: *"Lead with action, not questions. Never end with a question unless absolutely critical."*
- **Why:** Setiap pertanyaan di akhir = roundtrip extra yang user mau hindari. User pilih agent autonomous justru karena mau hemat decision fatigue.
- **How to apply:** Buka dengan apa yang sedang/sudah dilakukan, bukan analisis panjang. Tutup dengan ringkasan hasil + state berikutnya yang akan saya kerjakan, BUKAN "Mau saya lanjut?". Jika benar-benar perlu pilihan, kerjakan dulu jalur paling masuk akal, lalu sebut "kalau prefer pendekatan lain, kasih tahu" — bukan tanya dulu.

### Lint clean = goal nyata, bukan accept exception
- `CLAUDE.md` Code Review Mode: *"Berikan versi refactored langsung. Jangan hanya kritik tanpa solusi."*
- **Why:** Saat hampir 100% clean, sisa 1-2 warning sering saya kategorikan "accepted exception". Tapi kalau user bilang "ke akar masalah jangan diakali", maka semua exception itu sebenarnya ada solusi — `watch()` → `useWatch`, manual race-guard → `placeholderData: keepPreviousData`, dll. Saya menyerah terlalu cepat di "sudah cukup".
- **How to apply:** Saat lint masih ada error/warning, ASSUME ada solusi proper sebelum nego untuk accepted exception. Cek: (1) ada API alternatif? (2) refactor ke pattern yang library expect? (3) library sudah punya feature untuk kasus ini? Hanya accepted exception kalau benar-benar bug library upstream atau requires breaking change yang user belum approve.

## 2026-05-19

### Anti-pattern: setState di body render untuk "run once on mount"
- Pola `const [hasFetched, setHasFetched] = useState(false); if (!hasFetched) { setHasFetched(true); void fetchX(); }` di body komponen.
- **Why:** Itu side-effect di render → React 19/Next 16 menolak dengan warning "Can't perform a React state update on a component that hasn't mounted yet". ESLint `react-hooks/set-state-in-effect` juga melarang setState di dalam useEffect untuk pola ini. Idiom yang benar: `useRef(false) + useEffect` — ref mutation tidak trigger rerender.
- **How to apply:** Untuk "run-once on mount" yang punya dep dinamis (callback yang ter-recreate), pakai:
  ```ts
  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void fetchX();
  }, [fetchX]);
  ```
  Atau pakai `useApi`/TanStack Query untuk fetch GET sederhana — tidak perlu flag sama sekali. Anti-pattern ini muncul di 12+ file di repo ini; saat ketemu satu, **grep dulu** apakah ada copy-paste sebelum patch satu file saja.

### Audit todo.md saat menyelesaikan task yang men-touch file di "skip list"
- `tasks/todo.md` adalah SOT untuk progres migrasi/refactor. Beberapa file ditandai "Skip — Out-of-scope rewrite" karena trade-off effort vs value.
- **Why:** Saat user minta review + fix file yang ada di skip list (eksplisit override), todo.md jadi mismatch dengan kenyataan kalau saya tidak update. SOT bocor → developer berikutnya bingung. Lebih buruk: saya bisa tidak sadar sedang melanggar batasan yang sudah disetujui.
- **How to apply:** Saat menyelesaikan task non-trivial (≥3 file modified atau ≥1 file dari skip list), grep `tasks/todo.md` untuk file yang disentuh. Bila ada di skip list, update entry sekaligus tambahkan section ringkas untuk task tersebut (objective, checklist, verification, files changed, review notes). Jangan biarkan SOT divergen dari working tree.

### Refactor double-validate akibat perpindahan boundary fungsi
- Saat fungsi di-extract jadi reusable (mis. `createInventoryOpname` dipecah jadi `createInventoryOpname` + `createOpnameInTransaction` untuk dukung batch), guard validation bisa terduplikasi tanpa sengaja kalau kedua fungsi memanggil validate yang sama.
- **Why:** Wrapper memanggil validate, lalu memanggil inner yang juga memanggil validate — total 2× call ke gudang.findUnique per invocation. Test legacy yang pakai `mockResolvedValueOnce` jadi gagal karena mock sudah habis di call kedua. Production juga kena 2× DB query yang seharusnya 1×.
- **How to apply:** Setelah ekstrak fungsi inner, audit caller-nya: kalau wrapper jadi 1-liner yang langsung panggil inner, validate harus pindah ke inner saja. Jalankan test suite lengkap setelah refactor boundary fungsi yang punya side-effect/IO untuk catch double-call seperti ini.

### Permission strings di endpoint wajib match catalog (`PERMISSION_GROUPS` + `ACTIONS`)
- Bug nyata: `/api/admin/whatsapp/*` cek `hasPermission("settings:read")`. Resource `settings` tidak ada di `lib/permission-config.ts` (yang ada: `pengaturan`, `umum`, `whatsapp`, dll terpisah). Action `write` juga tidak ada di `ACTIONS` (yang ada: `read`, `create`, `update`, `delete`, …). Akibatnya: user yang sudah centang `whatsapp:read` di role custom tetap kena 403 — tidak ada cara legal untuk mendapat permission `settings:read` selain super admin wildcard.
- **Why:** Permission catalog adalah SOT untuk apa yang user bisa centang di UI. Kalau endpoint check resource/action di luar catalog, **tidak ada role custom yang bisa lulus** — hanya super admin wildcard `*` yang lolos. Bug ini silent: di staging, super admin pakai akun super → tidak ketahuan; user dengan role custom yang dapat 403.
- **How to apply:**
  - Saat menulis `hasPermission("X:Y")` atau `permissions: ["X:Y"]`, **wajib** verifikasi: (1) `X` ada di `PERMISSION_GROUPS` / `PERMISSION_GROUPS_MOBILE` / `GRANULAR_PERMISSIONS` / alias di `lib/permission-aliases.ts`, dan (2) `Y` ada di `ACTIONS` (atau merupakan granular path 3-segmen yang terdaftar).
  - Saat user lapor "403 padahal role saya sudah centang permission ini", jangan asumsikan masalah di seed/cache — cek dulu apakah string permission yang di-check endpoint **bisa di-centang** di UI role catalog. Jika tidak, perbaiki endpoint atau perluas catalog.
  - Audit komprehensif: cari semua `hasPermission(` dan `permissions: [` di `app/api/`, `lib/`, `modules/`. Kelompokkan permission unik, cross-check tiap satu ke catalog. Pakai subagent untuk audit besar agar context tetap bersih.
  - Saat menambah feature baru yang butuh permission baru, tambahkan resource ke `PERMISSION_GROUPS` **sebelum** atau **bersamaan** dengan endpoint, jangan setelah merge.

### Verifikasi perbaikan di runtime yang sebenarnya, bukan di HTML hasil render
- Kasus nyata: tautan "Masuk" di landing sudah benar (`curl` menunjukkan `href="https://admin.radpro.id/login"`), tapi klik tetap mendarat di apex. Saya sempat menyatakan selesai dua kali sebelum user menyuruh mengetesnya sendiri.
- **Why:** `NEXT_PUBLIC_*` disisipkan saat image dibangun, sedangkan server membacanya dari env runtime. Untuk env yang tidak didaftarkan sebagai build arg di `Dockerfile` (di repo ini hanya Firebase & VAPID), nilainya ada di server dan **undefined di browser**. HTML hasil render terlihat benar padahal komponen di klien mengambil cabang yang berbeda. Pola yang sama membuat `next/link` mencegat klik lintas subdomain dan membuang host-nya.
- **How to apply:**
  - Untuk bug UI, verifikasi di browser dengan sinyal perilaku, bukan sinyal bentuk: `event.defaultPrevented` setelah klik, URL akhir setelah navigasi, request `?_rsc=` di network log. `curl` hanya membuktikan SSR.
  - Sebelum memakai `process.env.NEXT_PUBLIC_X` di komponen klien, cek dulu ARG-nya ada di `Dockerfile`. Kalau tidak ada, turunkan nilainya dari `window.location` — jangan tambah build arg yang mengikat image ke satu domain (aplikasi ini melayani domain kustom tenant).
  - `next/link` hanya untuk tautan internal. Tautan absolut/lintas host wajib `<a>`.

### Portal tanpa sesi menurunkan tenant dari host, portal bersesi tidak
- Kasus nyata: `POST /api/customer/auth/login` membalas 500 di `pelanggan.<domain>` tapi 401 yang benar di apex — `lib/tenant-context.ts` mengembalikan "tanpa tenant" untuk semua subdomain portal dengan alasan "handled by proxy.ts".
- **Why:** `proxy.ts` hanya menulis ulang path; ia tidak pernah menetapkan tenant. Portal staf aman karena tenant-nya ada di token NextAuth, tetapi login pelanggan diproses **sebelum** ada cookie apa pun, sehingga host adalah satu-satunya sumber tenant. Tanpa itu, query pelanggan ditolak ekstensi Prisma (fail-closed) dan berubah jadi 500.
- **How to apply:** Saat menambah host portal baru, tanyakan apakah ada langkah pra-sesi di host itu. Jika ya, host wajib menghasilkan tenant context; jika tidak, biarkan fail-closed supaya host tidak pernah jadi sumber otoritas. Uji endpoint pra-sesi di **setiap** host yang melayaninya — identifier dummy sudah cukup, 500 vs 401 langsung membedakan bug isolasi tenant dari penolakan kredensial biasa.

### Jalankan typecheck lagi setiap kali menambah berkas tes, bukan hanya `vitest`
- Kasus nyata: build Jenkins #316 gagal di tahap Code Quality dengan satu error —
  `tests/modules/endorsement/endorsement-notification.test.ts: error TS7018: Object literal's property 'phone' implicitly has an 'any' type`.
  Berkas itu ditambahkan di commit terakhir; setelah membuatnya saya hanya menjalankan `vitest` dan `eslint`, tidak `tsc`.
- **Why:** `vitest` mengeksekusi tes tanpa memeriksa tipe, dan `eslint` tidak menyalakan `noImplicitAny`.
  Jadi berkas tes bisa hijau di lokal tetapi menggagalkan pipeline. Pola pemicunya selalu sama di repo ini:
  helper `const x = (over: Record<string, unknown> = {}) => ({ ...,, phone: null, ...over })` —
  properti bernilai `null` di object literal tanpa anotasi menghasilkan TS7018. Ini sudah terjadi
  tiga kali dalam satu sesi (`tenant-domain-service`, `endorsement-pdf-service`, `endorsement-notification`).
- **How to apply:**
  - Setelah menambah atau mengubah berkas apa pun di `tests/`, jalankan `npx tsc --noEmit -p tsconfig.typecheck.json`
    sebelum commit — bukan hanya `vitest`.
  - Untuk helper pembentuk data uji, beri tipe kembalian eksplisit dari tipe domain
    (`(over: Partial<X> = {}): X => ({...})`), jangan `Record<string, unknown>`.
  - Sebelum push yang memicu deploy, jalankan urutan yang sama dengan pipeline:
    typecheck → lint → test. Pipeline gagal di tahap pertama dan seluruh tahap sisanya di-skip,
    jadi satu error tipe membuang seluruh siklus build ~6 menit.

## Mengubah Dockerfile: validasi bentuk tidak cukup, jalankan stage-nya

- **Konteks:** Menghapus `npm prune` dan menambah stage `prod-deps` di `Dockerfile`.
  Dua percobaan push gagal berturut-turut, masing-masing membuang satu siklus CI ~12 menit.
- **Kegagalan 1 — tidak mengulang suite.** `tests/ci/jenkinsfile-build-safety.test.ts`
  menjaga jumlah `RUN npm run prisma:generate` di Dockerfile. Stage baru membuatnya jadi dua
  dan test itu merah. Saya hanya menjalankan `docker build --check`, lalu push.
- **Kegagalan 2 — tidak pernah menjalankan stage-nya.** `docker build --check` hanya memeriksa
  sintaks, tidak mengeksekusi apa pun. Stage baru gagal di `npm run prisma:generate` karena
  config Prisma berformat TypeScript membaca `DATABASE_URL` saat dimuat, dan variabel itu
  hanya ada di stage builder.
- **Why:** `Dockerfile` bukan berkas yang bebas dari test — ada penjaga yang membacanya. Dan
  perintah di dalamnya baru terbukti benar ketika benar-benar dijalankan, bukan ketika lolos lint.
- **How to apply:**
  - Setelah mengubah `Dockerfile`, jalankan `npx vitest run tests/ci/` — ada penjaga di sana.
  - Bangun stage yang diubah secara lokal: `docker build --target <stage> --platform linux/amd64 .`
    Stage kecil seperti `prod-deps` selesai dalam hitungan menit, jauh lebih murah daripada siklus CI.
  - Kalau stage itu memasok `node_modules` ke image runtime, bandingkan isinya dengan pod produksi
    yang berjalan (`kubectl exec ... ls node_modules/.prisma/client`) sebelum push — itu satu-satunya
    cara membuktikan tidak ada yang hilang.

## Status keluar pipa menyembunyikan kegagalan perintah pertamanya

- **Konteks:** Menulis langkah cadangan pra-migrasi di `.gitea/workflows/deploy-production.yml`.
  Versi pertama memakai `kubectl exec ... -- sh -c 'pg_dump ...' | gzip > berkas.gz`.
  Uji jalur gagal ke variabel URL yang tidak ada: `pg_dump` mati dengan exit 1, tetapi langkahnya
  melaporkan **sukses**. Yang menangkapnya hanya ambang ukuran berkas, bukan status perintahnya.
- **Why:** Status keluar sebuah pipa adalah status perintah **terakhir**-nya. `gzip` menerima EOF
  saat `pg_dump` mati, lalu menutup arsipnya dengan rapi — hasilnya gzip yang sah berisi dump
  terpotong. Artinya `gzip -t` pun lolos. Untuk dump besar yang putus di tengah, ukurannya juga
  jauh di atas ambang mana pun, jadi tidak ada satu pun pemeriksaan hilir yang akan menangkapnya.
  `set -o pipefail` tidak menolong di sini: pipanya ada di shell **remote** (lewat `ssh`) atau di
  dalam pod, bukan di shell runner yang punya `pipefail`.
- **How to apply:**
  - Untuk perintah yang hasilnya menjadi jaring pengaman (cadangan, ekspor, dump), **jangan
    dipipa**. Tulis keluarannya apa adanya, lalu kompresi/olah sebagai perintah terpisah supaya
    tiap tahap punya status sendiri.
  - Selalu uji jalur gagalnya, bukan hanya jalur suksesnya. Pesan kegagalan yang menyebut tahap
    yang salah ("arsip tidak utuh" padahal `pg_dump` yang mati) adalah tanda status sedang tertelan.

## Perilaku `grep` pada masukan kosong berbeda antar implementasi

- **Konteks:** Preflight memeriksa `CRON_SECRET` live bukan placeholder dengan
  `... | grep -qxv REPLACE_WITH_REAL_SECRET_BEFORE_DEPLOY`. Idenya: baris placeholder tersaring,
  masukan kosong juga tidak menghasilkan baris, jadi keduanya gagal.
- **Why:** BSD grep (macOS) mengembalikan **0** untuk masukan kosong, GNU grep (Linux) mengembalikan 1.
  Pemeriksaannya kebetulan benar di produksi dan salah di mesin pengembang — arah yang paling
  berbahaya, karena jalur negatifnya tidak pernah terlihat gagal saat diuji lokal.
- **How to apply:**
  - Jangan gantungkan pemeriksaan keamanan pada perilaku `grep` terhadap masukan kosong.
    Tulis perbandingannya eksplisit: `[ -n "$nilai" ] && [ "$nilai" != PLACEHOLDER ]`.
  - Nilai kosong hampir selalu kondisi yang paling perlu tertangkap, jadi beri ia pemeriksaan
    sendiri alih-alih menumpangkannya pada efek samping perintah lain.

## Sebelum menghapus sebuah tool, pindahkan dulu jaminannya — dan baca isi tesnya, bukan namanya

- **Konteks:** Menghapus Jenkins. `Jenkinsfile` punya tiga jaminan produksi yang tidak pernah ikut
  pindah saat pipeline bermigrasi ke Gitea: preflight kesehatan node, pemeriksaan secret live, dan
  **cadangan basis data pra-migrasi**. Menghapus berkasnya saat itu juga berarti menghapus jaring
  pengamannya diam-diam — padahal yang menghilangkannya adalah migrasi sebelumnya, bukan penghapusan ini.
- **Why:** Berkas yang "sudah tidak dipakai" bisa tetap menjadi satu-satunya tempat sebuah jaminan
  tertulis. Nama berkas tes juga menyesatkan: `tests/ci/jenkinsfile-build-safety.test.ts` ternyata
  memuat empat tes yang sama sekali tidak membaca `Jenkinsfile` — isinya tentang manifes produksi,
  `Dockerfile`, dan `.dockerignore`. Menghapusnya berdasarkan nama akan membuang keempatnya.
- **How to apply:**
  - Inventarisasi dulu: `grep -ril <tool>` di seluruh repo, lalu pisahkan rujukan hidup dari catatan historis.
  - Untuk tiap tes yang akan dihapus, periksa berkas apa yang benar-benar dibacanya
    (`readFileSync`), bukan namanya. Pindahkan bagian yang subjeknya bukan tool itu.
  - Untuk tiap jaminan yang masih berlaku, tulis tesnya terhadap pengganti, **lihat merah dulu**,
    baru implementasikan — lalu hapus tool-nya.
  - Kalau ada kemampuan yang benar-benar hilang tanpa padanan (di sini: mode recovery Jenkins),
    katakan terus terang dan dokumentasikan jalur penggantinya, jangan diam-diam.

## Menghapus fitur berdasarkan nama: cari lewat PATH juga, bukan hanya isi berkas

- **Konteks:** Menghapus MixRadius. `git grep -il mixradius` menemukan 305 berkas, tetapi melewatkan
  35 berkas yang hanya cocok lewat path — termasuk 4 route approval RAB di
  `app/api/integrations/mixradius/expenses/rab/**` yang isinya murni `modules/finance` dan tidak
  memuat kata "mixradius" sama sekali. Seluruh UI RAB/pengeluaran juga menumpang di path MixRadius.
- **Why:** Menghapus folder berdasarkan nama path akan ikut membuang fitur lokal yang masih hidup
  (di sini: approval, revisi, dan pengeluaran RAB). Sebaliknya grep isi saja tidak pernah melihat
  berkas-berkas itu, sehingga keberadaannya tidak tercatat di rencana.
- **How to apply:**
  - Inventaris selalu dua jalur: `git grep -il <nama>` **dan** `git ls-files | grep -i <nama>`,
    lalu bandingkan berkas yang hanya cocok lewat path.
  - Untuk tiap berkas di path fitur, tanyakan "apakah ini bergantung pada fitur itu, atau hanya
    menumpang?" Yang menumpang dipindah ke modul pemiliknya, bukan dihapus.
  - Sapuan akhir pakai `git grep --untracked`: berkas hasil pindahan belum di-track, sehingga
    `git grep` biasa melewatkannya dan menghasilkan "bersih" palsu.
  - Sebelum mencabut fallback permission, periksa arah alias (`resolvePermissionAliases` hanya
    satu arah) dan data role nyata; role yang hanya memegang resource lama perlu migration grant.

## Langkah operasional pasca-perubahan: jalankan sendiri, jangan dilempar ke user

- **Konteks:** Setelah push penghapusan MixRadius, saya menutup dengan daftar "yang perlu Anda lakukan"
  (jalankan skrip backfill di produksi, cek env `MIXRADIUS_*` di pod). User mengoreksi: "mustinya kamu
  saja yang jalankan, agar bisa kamu lihat perubahannya".
- **Why:** User memilih agent justru supaya eksekusi dan pembacaan hasilnya ditangani sampai tuntas.
  Menyerahkan perintah berarti hasilnya tidak pernah diverifikasi oleh pihak yang paham konteks perubahan.
- **How to apply:**
  - Untuk langkah non-destruktif yang aksesnya tersedia (pantau deploy, cek env, dry-run skrip,
    backfill idempoten yang diminta), kerjakan sendiri lalu laporkan hasil nyata — bukan instruksi.
  - Tetap berhenti pada aksi destruktif/tak terbalikkan (drop tabel/kolom) sampai ada persetujuan eksplisit.
  - Jika aturan izin sesi menolak (mis. auto mode "Production Reads" untuk `ssh radpro sudo kubectl`),
    jangan mengakali lewat jalur lain. Jelaskan apa yang dibutuhkan, siapkan perintah persisnya, dan
    beri user pilihan: tambahkan aturan izin, atau jalankan dengan prefix `!` agar output masuk ke sesi.
  - Akses produksi yang terbukti: `ssh radpro` → `sudo kubectl -n netmanager-production ...`
    (user `radpro` tanpa kubeconfig pribadi; kubectl non-sudo gagal membaca `/etc/rancher/k3s/k3s.yaml`).
