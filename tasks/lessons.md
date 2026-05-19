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
