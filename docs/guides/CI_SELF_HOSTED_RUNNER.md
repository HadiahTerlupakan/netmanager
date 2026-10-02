# Self-hosted runner GitHub Actions (VM Proxmox)

Semua job CI/CD `netmanager` dan `mobile-netmanager` dapat berjalan di VM sendiri.
GitHub tetap menjadi orkestrator (workflow, secret, environment, log); VM hanya
mengerjakan job-nya dan cukup membuka koneksi **keluar** ke GitHub.

## Host

| Item | Nilai |
|---|---|
| VM Proxmox | `cicd` (alias SSH `ci-runner`), Ubuntu 24.04, 16 vCPU (type `host`, NUMA), 24 GB RAM tanpa ballooning, 150 GB SSD |
| IP | `31.56.30.51` (publik) |
| Akses | SSH kunci saja (`~/.ssh/id_ed25519_ci`), root dilarang, `ufw` hanya 22/tcp, `fail2ban`, `qemu-guest-agent` |
| Runner | user `runner`, service systemd `actions.runner.*`, label `radpro-ci` |
| Jumlah | 4 untuk `netmanager` (shard tes paralel), 2 untuk `mobile-netmanager` |

Runner akun personal hanya bisa didaftarkan per repo, karena itu ada dua kelompok.

## Memilih runner: variabel repo `CI_RUNS_ON`

Setiap job memakai:

```yaml
runs-on: ${{ fromJSON(vars.CI_RUNS_ON || '"ubuntu-24.04"') }}
```

| `CI_RUNS_ON` | Job berjalan di |
|---|---|
| (tidak diset) | runner GitHub `ubuntu-24.04` |
| `["self-hosted","radpro-ci"]` | VM sendiri |

```bash
# pindah ke VM
gh variable set CI_RUNS_ON --repo HadiahTerlupakan/netmanager --body '["self-hosted","radpro-ci"]'
gh variable set CI_RUNS_ON --repo HadiahTerlupakan/mobile-netmanager --body '["self-hosted","radpro-ci"]'
# kembali ke runner GitHub (mis. VM mati)
gh variable delete CI_RUNS_ON --repo HadiahTerlupakan/netmanager
gh variable delete CI_RUNS_ON --repo HadiahTerlupakan/mobile-netmanager
```

Tes kontrak (`mobile-netmanager/__tests__/ci/github-workflow-security.test.ts`) menjaga
semua job memakai ekspresi yang sama.

## Membangun ulang host

```bash
scp scripts/ci-runner/*.sh ci-runner:/tmp/
ssh ci-runner 'sudo bash /tmp/pasang-host-runner.sh'
T=$(gh api -X POST repos/HadiahTerlupakan/netmanager/actions/runners/registration-token --jq .token)
ssh ci-runner "sudo bash /tmp/daftarkan-runner.sh HadiahTerlupakan/netmanager 4 $T"
T=$(gh api -X POST repos/HadiahTerlupakan/mobile-netmanager/actions/runners/registration-token --jq .token)
ssh ci-runner "sudo bash /tmp/daftarkan-runner.sh HadiahTerlupakan/mobile-netmanager 2 $T"
```

`pasang-host-runner.sh` memasang Docker + buildx, JDK 17 headless (hanya untuk menerima
lisensi Android), Android cmdline-tools di `/opt/android-sdk`, user `runner` (sudo tanpa
password, grup docker — sama dengan runner GitHub), dan pembersihan Docker mingguan.
Node dan JDK untuk build diunduh `setup-node` / `setup-java` per job.

## Hal yang perlu diingat

- **Runtime OTA mobile.** `runtimeVersion` adalah fingerprint yang berbeda antar mesin
  build. Build Android pertama di VM menghasilkan runtime baru → perlu rilis Play baru dan
  OTA berikutnya hanya diterima HP yang sudah update. Setelah pindah, semua build native
  harus di VM ini. Workflow OTA tidak terdampak (runtime tujuan dibaca dari `native-build.json`).
- **Repo publik.** Workflow `netmanager` hanya dipicu `push` ke `main`, `workflow_dispatch`,
  dan `schedule` — tidak pernah `pull_request` — sehingga kode dari fork tidak bisa jalan
  di VM. Jangan menambah pemicu `pull_request` selama repo publik memakai runner ini.
- **Ketersediaan.** Bila VM mati, job mengantre. Hapus `CI_RUNS_ON` untuk sementara memakai
  runner GitHub.
- **Pemeliharaan.** `sudo apt upgrade` berkala; runner memperbarui dirinya sendiri.
  Status: `ssh ci-runner 'systemctl list-units "actions.runner.*"'`.
