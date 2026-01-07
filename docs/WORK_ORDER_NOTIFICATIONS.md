# Product Requirement Document (PRD): Work Order Notifications

**Version:** 1.0
**Status:** Implemented
**Date:** 2026-01-07

## 1. Overview

Fitur notifikasi ini bertujuan untuk memastikan komunikasi real-time yang efektif antara **Portal Admin** (Back Office) dan **Mobile App** (Teknisi Lapangan) terkait siklus hidup Work Order (WO), mulai dari pembuatan hingga penyelesaian.

## 2. Objectives

- **Real-time Awareness:** Memastikan teknisi tahu segera saat ditugaskan, dan Admin tahu segera saat teknisi melakukan aksi.
- **Noise Reduction:** Mencegah spam dengan memfilter notifikasi agar user tidak menerima notifikasi atas aksi yang mereka lakukan sendiri (_Self-Exclusion_).
- **Access Control:** Memastikan notifikasi hanya sampai ke user yang berhak melihat WO tersebut (berdasarkan Departemen dan Site).

## 3. User Stories

### Sebagai Admin

1.  Saya ingin teknisi segera tahu (via Push Notification) ketika saya menugaskan WO kepadanya.
2.  Saya ingin menerima pemberitahuan saat teknisi mengambil tiket (_Claim_), memulai kerja (_Start_), atau menyelesaikannya (_Complete_).
3.  Saya tidak ingin menerima notifikasi dari aksi saya sendiri (misal: saya mengedit WO, saya tidak butuh notifikasi "WO Updated").

### Sebagai Teknisi

1.  Saya ingin menerima notifikasi spesifik "Di-assign ke Anda" agar saya tahu prioritas tugas saya.
2.  Saya ingin tahu jika ada WO baru di area/departemen saya yang belum diambil (Available).
3.  Saya tidak ingin HP saya berbunyi notifikasi saat saya sendiri yang menekan tombol "Start" atau "Selesai" di aplikasi.

## 4. Functional Requirements

### 4.1. Alur: Admin to Mobile (Downstream)

| Trigger Event                     | Audience                         | Message Format                    | Channel                   |
| :-------------------------------- | :------------------------------- | :-------------------------------- | :------------------------ |
| **New WO Created** (Unassigned)   | Teknisi di Dept terkait + Global | "🎯 Work Order Baru: [Nomor]"     | Push (Standard)           |
| **New WO Created** (Assigned)     | Assignee (Teknisi)               | "📋 Work Order Di-assign ke Anda" | Push (Standard)           |
| **Assignment Change** (Re-assign) | Assignee Baru                    | "📋 Work Order Di-assign ke Anda" | Push (Sticky/Interactive) |

### 4.2. Alur: Mobile to Admin (Upstream)

| Trigger Event       | Audience              | Message Format                                   | Channel   |
| :------------------ | :-------------------- | :----------------------------------------------- | :-------- |
| **Claim Ticket**    | Admin + Observer Dept | "🎯 [Nama] claim ticket [Nomor]"                 | Web Alert |
| **Start Work**      | Admin + Observer Dept | "▶️ Status WO Berubah: Pending -> In Progress"   | Web Alert |
| **Add Note/Update** | Admin + Observer Dept | "💬 Update pada [Nomor]: [Pesan]"                | Web Alert |
| **Complete Work**   | Admin + Observer Dept | "✅ Status WO Berubah: In Progress -> Completed" | Web Alert |

## 5. Technical Requirements & Logic

### 5.1. Filtering Logic (Recipients)

Sistem harus mencari penerima notifikasi (`findEligibleRecipients`) dengan aturan:

1.  **Permission Check:** User harus memiliki `workorders:read`.
2.  **Department Scope:**
    - Jika WO memiliki `departmentId`: Penerima harus anggota Dept tersebut ATAU Admin Global (`departmentId: null`).
    - Jika WO Global (`departmentId: null`): Semua user yang memenuhi syarat (Site) menerima.
3.  **Site Scope:**
    - Jika user memiliki batasan `site_only`: Hanya terima jika WO berada di Site user atau WO Global.
    - Jika user tidak punya batasan: Terima semua Site.

### 5.2. Self-Exclusion Logic

Setiap notifikasi wajib memeriksa `triggeredByUserId`. User ID ini harus **dikeluarkan** dari daftar penerima final.

- _Implementation:_ `list.filter(u => u.id !== triggeredByUserId)`

### 5.3. Push Notification Priority

- **Assignment** dianggap Prioritas Tinggi. Menggunakan channel Push yang mungkin membutuhkan interaksi user atau bunyi khusus.
- **Status Update** dianggap Prioritas Normal.

## 6. Edge Cases

- **User tanpa Token Push:** Notifikasi hanya masuk ke _In-App Notification_ (Database), tidak ada Push ke HP.
- **Admin melakukan aksi di Mobile:** Logic tetap berlaku sama (Admin tidak menerima notifikasi diri sendiri, Admin lain menerima).
