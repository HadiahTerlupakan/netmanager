# Git, CI, and Secret Hygiene Standard

> **Tujuan:** mencegah kebocoran token/credential, membedakan apa yang boleh diaudit dari repo saja vs apa yang harus diverifikasi di server/CI, dan menjaga praktik operasional tetap konsisten.

---

## 1. Prinsip Utama

1. **No tokenized remotes** — remote git lokal tidak boleh menyimpan PAT langsung di URL.
2. **CI should prefer managed credentials** — pipeline harus memakai secret store terkelola (Gitea repo/org secrets), bukan token hardcoded di workflow atau repo.
3. **Templates may exist, live secrets must not** — template secret boleh ada di repo, tapi secret nyata tidak boleh disimpan plaintext di git.
4. **Repo audit is not server audit** — beberapa temuan bisa dibuktikan dari repo, tapi secret store dan runtime CI tetap butuh akses server.

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

## 3. CI-Side Rules

### Wajib

- Kredensial SCM harus memakai secret store Gitea, misalnya:
  - `github-ssh`
- Audit CI harus memeriksa:
  - credential IDs yang dipakai job
  - tipe credential (SSH key / secret text / username-password)
  - apakah credential dibatasi ke job/folder yang tepat
  - apakah log build mem-mask secret dengan benar

### Dilarang

- token hardcoded di berkas workflow
- reuse PAT yang sama untuk banyak repo tanpa alasan kuat
- membiarkan tokenized remote di workstation developer tanpa rotasi

---

## 4. Secret Manifest Rules

### Wajib

- `k8s/production/secrets.yaml` dianggap **template**, bukan source of truth untuk live secret.
- Untuk deployment nyata, gunakan salah satu:
  - SOPS
  - SealedSecrets
  - external secret manager / secret injection CI / Kubernetes secret management yang setara

### Dilarang

- menyimpan secret live di `stringData` plaintext lalu commit ke repo
- copy-paste secret nyata ke file template dan meninggalkannya di workstation

---

## 5. Operational Checklist

Saat audit security hygiene:

- [ ] Apakah remote git lokal mengandung PAT/token?
- [ ] Apakah token yang bocor di lokal juga dipakai di CI?
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

### Butuh akses server/CI

- isi credential store Jenkins
- tipe credential yang sebenarnya dipakai oleh credential ID
- apakah PAT/token tertentu aktif dipakai Jenkins atau tidak
- masking log dan environment injection runtime
- secret file/mount yang benar-benar aktif di host/controller/agent

---

## 7. Current Audit Outcome (per 14 September 2026)

- CI/CD sepenuhnya di **Gitea Actions**. Jenkins beserta namespace, ingress,
  sertifikat, dan secret-nya sudah dihapus dari cluster; cadangan namespace
  tersimpan di `/root/jenkins-namespace-backup-20260914-101216/` pada host
  produksi.
- Rahasia deploy (`DEPLOY_SSH_KEY`, `DEPLOY_SSH_TARGET`, `DEPLOY_KNOWN_HOSTS`,
  kredensial registry, `APP_UPDATE_PUBLISH_TOKEN`) disimpan sebagai secret repo
  Gitea, tidak pernah dicetak ke log, dan `DEPLOY_SSH_KEY` sengaja tidak
  dibawa ke job `quality` yang menjalankan lint/typecheck/tes.
- Template `k8s/*/secrets.yaml` tetap placeholder dan **tidak pernah di-apply**
  pipeline; secret hidup di-bootstrap manual di cluster.
- Temuan yang belum selesai: service account key Firebase
  `firebase-adminsdk-fbsvc@netmanager-96742.iam.gserviceaccount.com`
  (key id `54f6269e…`) pernah masuk riwayat git. Berkasnya sudah dilepas dari
  version control, tetapi **kunci itu sendiri belum dirotasi di GCP**.

### Implikasi

- riwayat git masih memuat kunci tersebut; menghapus berkas tidak membatalkan
  kunci, jadi rotasi di GCP tetap satu-satunya penutup celahnya

---

## 8. Immediate Recommended Actions

1. **Rotasi service account key Firebase di GCP**, lalu perbarui secret
   `netmanager-firebase-secrets` di namespace produksi
2. **Pastikan remote git lokal tidak menyimpan PAT** — pakai SSH atau HTTPS
   tanpa token tertanam
3. **Tinjau ulang daftar secret repo Gitea** secara berkala dan persempit
   cakupannya bila ada yang tidak lagi terpakai
