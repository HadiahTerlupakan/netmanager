# Git, Jenkins, and Secret Hygiene Standard

> **Tujuan:** mencegah kebocoran token/credential, membedakan apa yang boleh diaudit dari repo saja vs apa yang harus diverifikasi di server/Jenkins, dan menjaga praktik operasional tetap konsisten.

---

## 1. Prinsip Utama

1. **No tokenized remotes** — remote git lokal tidak boleh menyimpan PAT langsung di URL.
2. **Jenkins should prefer managed credentials** — Jenkins harus memakai credential store terkelola (contoh: SSH credential ID), bukan hardcoded token di job config/repo.
3. **Templates may exist, live secrets must not** — template secret boleh ada di repo, tapi secret nyata tidak boleh disimpan plaintext di git.
4. **Repo audit is not server audit** — beberapa temuan bisa dibuktikan dari repo, tapi credential store/runtime Jenkins tetap butuh akses server/Jenkins.

---

## 2. Repo-Side Rules

### Wajib

- Gunakan remote git berbasis:
  - SSH (`git@github.com:org/repo.git`), atau
  - HTTPS tanpa token embedded
- Pastikan `.env`, backup SQL, service account JSON, dan credential lokal tetap di-ignore.
- File `k8s/*/secrets.yaml` di repo hanya boleh berupa **template placeholder**, bukan secret live.

### Dilarang

- `origin https://ghp_...@github.com/...`
- commit secret aktif ke `.env`, `secrets.yaml`, atau markdown/runbook
- mengandalkan note README yang mendorong edit plaintext secret tanpa mitigasi

---

## 3. Jenkins-Side Rules

### Wajib

- Credential SCM Jenkins harus memakai credential store Jenkins, misalnya:
  - `github-ssh`
- Audit Jenkins harus memeriksa:
  - credential IDs yang dipakai job
  - tipe credential (SSH key / secret text / username-password)
  - apakah credential dibatasi ke job/folder yang tepat
  - apakah log build mem-mask secret dengan benar

### Dilarang

- hardcoded token di Jenkins job config
- reuse PAT yang sama untuk banyak repo tanpa alasan kuat
- membiarkan tokenized remote di workstation developer tanpa rotasi

---

## 4. Secret Manifest Rules

### Wajib

- `k8s/production/secrets.yaml` dianggap **template**, bukan source of truth untuk live secret.
- Untuk deployment nyata, gunakan salah satu:
  - SOPS
  - SealedSecrets
  - external secret manager / Jenkins secret injection / Kubernetes secret management yang setara

### Dilarang

- menyimpan secret live di `stringData` plaintext lalu commit ke repo
- copy-paste secret nyata ke file template dan meninggalkannya di workstation

---

## 5. Operational Checklist

Saat audit security hygiene:

- [ ] Apakah remote git lokal mengandung PAT/token?
- [ ] Apakah token yang bocor di lokal juga dipakai di Jenkins?
- [ ] Apakah Jenkins SCM checkout memakai SSH credential terkelola?
- [ ] Apakah credentials.xml / job config menunjukkan credential type yang sesuai?
- [ ] Apakah repo hanya berisi template secret, bukan secret live?
- [ ] Apakah operator masih diarahkan ke plaintext secret workflow tanpa mitigasi?
- [ ] Apakah token yang terdeteksi sudah di-rotate bila pernah terekspos?

---

## 6. What Can Be Audited Without Server Access?

### Bisa dari repo/local saja

- tokenized git remotes lokal
- secret placeholders vs secret live di repo
- plaintext secret workflow di docs/scripts
- Jenkinsfile credential references (`credentialsId`, secret env references, dll)

### Butuh akses Jenkins/server

- isi credential store Jenkins
- tipe credential yang sebenarnya dipakai oleh credential ID
- apakah PAT/token tertentu aktif dipakai Jenkins atau tidak
- masking log dan environment injection runtime
- secret file/mount yang benar-benar aktif di host/controller/agent

---

## 7. Current Audit Outcome (Current State)

Audit saat ini menemukan:

- local git remotes di workstation mengandung PAT embedded untuk `netmanager` dan `mobile-netmanager`
- Jenkins server untuk job `netmanager-staging` terbukti menggunakan credential ID `github-ssh` untuk checkout, bukan URL PAT dari workstation lokal
- `credentials.xml` mengandung setidaknya:
  - `BasicSSHUserPrivateKey`
  - `StringCredentialsImpl`
  - `UsernamePasswordCredentialsImpl`
- template `k8s/*/secrets.yaml` masih placeholder, tetapi workflow dokumentasi masih mendorong edit plaintext secret template secara manual

### Implikasi

- kebocoran PAT lokal adalah **real local hygiene issue**
- tapi dari bukti yang ada, itu **belum terbukti** sama dengan credential Jenkins yang aktif
- audit Jenkins secrets yang lengkap memang **butuh akses server/Jenkins**, dan itu sudah benar untuk dilakukan bila ingin memastikan runtime hygiene

---

## 8. Immediate Recommended Actions

1. **Rotate PAT yang terekspos di remote lokal**
2. **Ubah remote lokal ke SSH atau HTTPS tanpa embedded token**
3. **Review credential IDs aktif di Jenkins** dan pastikan checkout tetap pakai `github-ssh`
4. **Kurangi workflow plaintext secret** di staging/production docs, arahkan ke encrypted/managed path
5. **Audit penggunaan `StringCredentialsImpl` dan `UsernamePasswordCredentialsImpl`** di Jenkins apakah masih diperlukan atau bisa dipersempit scope-nya
