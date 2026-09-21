# Image runner untuk pipeline netmanager (`runs-on: netmanager-ci`).
#
# SALINAN OTORITATIF. Yang benar-benar dipakai runner ada di
# `/home/ubuntu/ci-image/Dockerfile` pada host Gitea; berkas ini ada di repo
# supaya perubahannya terlihat saat review dan tidak menyimpang diam-diam.
#
# Riwayat yang membuatnya diversikan (2026-09-21): image ini tertinggal di
# `node:20-bullseye` selama berbulan-bulan sementara `package.json` menuntut
# `>=24.0.0` dan image produksi memakai `node:24-alpine`. Akibatnya job
# `quality` — lint, typecheck, dan 4136 tes — memvalidasi di runtime yang tidak
# pernah dipakai menjalankan aplikasi, dan `npm ci` mencetak EBADENGINE tiap
# run tanpa ada yang menindaklanjuti. Karena definisinya hidup di luar repo,
# penyimpangan itu tidak pernah muncul di review.
#
# Biner docker/buildx/kubectl disalin dari berkas lokal, bukan diunduh saat
# build: dari VPS ini download.docker.com hanya ~14 KB/s dan dl.k8s.io tidak
# tembus sama sekali, sedangkan berkasnya bisa dikirim dari luar dalam hitungan
# detik. Ketiganya ada di `/home/ubuntu/ci-image/` pada host.
#
# Cara membangun ulang di host Gitea:
#   cd /home/ubuntu/ci-image
#   docker tag netmanager-ci:latest netmanager-ci:node<versi-lama>-cadangan
#   docker build -t netmanager-ci:node<versi-baru>-uji .
#   docker run --rm --entrypoint sh netmanager-ci:node<versi-baru>-uji -c \
#     'node -v; docker --version; docker buildx version; kubectl version --client=true'
#   docker tag netmanager-ci:node<versi-baru>-uji netmanager-ci:latest
#
# Rollback bila pipeline bermasalah:
#   docker tag netmanager-ci:node<versi-lama>-cadangan netmanager-ci:latest
#
# `bookworm`, bukan `bullseye`: Debian 12 adalah basis yang dipakai tag
# `node:24` resmi. Biner glibc yang disalin di atas tetap jalan karena glibc
# bookworm kompatibel-mundur terhadap yang dibangun untuk bullseye.
FROM node:24-bookworm

COPY docker-cli    /usr/local/bin/docker
COPY docker-buildx /usr/local/libexec/docker/cli-plugins/docker-buildx
COPY kubectl       /usr/local/bin/kubectl

RUN chmod +x /usr/local/bin/docker \
             /usr/local/bin/kubectl \
             /usr/local/libexec/docker/cli-plugins/docker-buildx \
 && docker --version \
 && docker buildx version \
 && kubectl version --client=true | head -1 \
 && git --version
