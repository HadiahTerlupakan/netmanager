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
