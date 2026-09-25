import { describe, expect, it } from "vitest";

import {
  deployScriptSectionIndex,
  readBuildWorkflow,
  readDeployScript,
  readDeployScriptSection,
  readWorkflowJob,
  runBash,
  stripCommentLines,
} from "../helpers/deploy-sources";

/**
 * Jaminan skrip deploy produksi (`scripts/deploy/netmanager-deploy.sh`).
 *
 * Skrip ini berjalan di host produksi lewat forced command SSH, dan satu-satunya
 * masukannya adalah SHA commit. Jaminan di sini dua macam:
 *
 * 1. Batas kepercayaan: kunci deploy yang bocor paling jauh hanya bisa
 *    men-deploy ulang commit yang memang ada di `main`. Tag image, manifes,
 *    dan keabsahan commit diturunkan skrip sendiri, bukan diterima dari
 *    pemanggil.
 * 2. Jaminan yang dulu dijaga terhadap Jenkinsfile lalu workflow Gitea: image
 *    yang tidak pernah terdorong, template secret yang ikut ter-apply, manifes
 *    yang masih menyimpan placeholder, dan migrasi gagal yang ditunggu sampai
 *    batas waktu — semuanya berakhir sebagai deploy hijau yang mati di cluster.
 */

const SHA_SAH = "0123456789abcdef0123456789abcdef01234567";
const FLAG_TANPA_CADANGAN = "--izinkan-tanpa-cadangan";

/**
 * Potongan penguraian masukan, berhenti sebelum skrip melepaskan diri dari
 * sesi SSH (yang akan menjalankan ulang seluruh skrip) dan sebelum `flock`.
 */
function readInputParsing(): string {
  const section = readDeployScriptSection("Masukan");
  const end = section.indexOf('if [ -z "${NETMANAGER_DEPLOY_TERLEPAS:-}" ]');
  expect(end).toBeGreaterThan(0);
  expect(end).toBeLessThan(section.indexOf("exec 9>"));
  return section.slice(0, end);
}

interface ParsedInput {
  isAccepted: boolean;
  sha?: string;
  isBackupBypassAllowed?: boolean;
}

/** Jalankan penguraian masukan skrip yang sesungguhnya dan laporkan hasilnya. */
function parseInput(args: string[], sshOriginalCommand?: string): ParsedInput {
  const quotedArgs = args.map((arg) => `'${arg.replace(/'/g, "'\\''")}'`).join(" ");
  const result = runBash(
    [
      "set -euo pipefail",
      'gagal() { echo "GAGAL"; exit 1; }',
      `set -- ${quotedArgs}`,
      readInputParsing(),
      'echo "SHA=${SHA}"',
      'echo "IZIN=${IZIN_TANPA_CADANGAN}"',
    ].join("\n"),
    sshOriginalCommand === undefined ? {} : { SSH_ORIGINAL_COMMAND: sshOriginalCommand },
  );
  if (!result.isSuccess) return { isAccepted: false };
  return {
    isAccepted: true,
    sha: result.stdout.match(/^SHA=(.*)$/m)?.[1],
    isBackupBypassAllowed: result.stdout.match(/^IZIN=(.*)$/m)?.[1] === "true",
  };
}

/** Blok `case` status perbandingan commit terhadap `main`. */
function readCompareCase(): string {
  const section = readDeployScriptSection("1.");
  const start = section.indexOf('case "${STATUS_BANDING}" in');
  const end = section.indexOf("esac", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return section.slice(start, end + "esac".length);
}

/** Apakah status compare API tertentu diterima skrip sebagai commit di `main`. */
function isCompareStatusAccepted(status: string): boolean {
  return runBash(
    [
      'gagal() { exit 1; }',
      `STATUS_BANDING='${status}'`,
      readCompareCase(),
    ].join("\n"),
  ).isSuccess;
}

/**
 * Stub kubectl untuk menjalankan bagian skrip yang memakai `${K}`: menjawab
 * kueri kondisi Job dan image aktif dari env, dan mengabaikan perintah lain.
 */
const KUBECTL_PALSU = `
kubectl_palsu() {
  case "$*" in
    *'type=="Complete"'*) printf '%s' "\${KONDISI_COMPLETE:-}" ;;
    *'type=="Failed"'*) printf '%s' "\${KONDISI_FAILED:-}" ;;
    *'containers[0].image'*) printf '%s' "\${IMAGE_AKTIF:-}" ;;
  esac
}
K=kubectl_palsu
gagal() { echo "GAGAL: $*"; exit 1; }
KERJA="$(mktemp -d)"
trap 'rm -rf "\${KERJA}"' EXIT
mkdir -p "\${KERJA}/rendered"
sleep() { :; }
`;

describe("masukan skrip deploy", () => {
  it("menerima SHA 40 heksadesimal dari forced command SSH", () => {
    expect(parseInput([], SHA_SAH)).toEqual({
      isAccepted: true,
      sha: SHA_SAH,
      isBackupBypassAllowed: false,
    });
  });

  it.each([
    ["kosong", ""],
    ["SHA pendek", SHA_SAH.slice(0, 12)],
    ["41 karakter", `${SHA_SAH}0`],
    ["huruf besar", SHA_SAH.toUpperCase()],
    ["nama cabang", "main"],
    ["bukan heksadesimal", `${SHA_SAH.slice(0, 39)}g`],
    ["disusupi perintah", `${SHA_SAH};id`],
    ["bendera di depan", `${FLAG_TANPA_CADANGAN} ${SHA_SAH}`],
  ])("menolak masukan yang bukan SHA 40 heksadesimal (%s)", (_kasus, masukan) => {
    expect(parseInput([], masukan).isAccepted).toBe(false);
    expect(parseInput([masukan]).isAccepted).toBe(false);
  });

  it("hanya memakai token pertama SSH_ORIGINAL_COMMAND", () => {
    const hasil = parseInput([], `${SHA_SAH} argumen-lain lagi`);

    expect(hasil.isAccepted).toBe(true);
    expect(hasil.sha).toBe(SHA_SAH);
  });

  it("tidak bisa melewati cadangan lewat forced command", () => {
    // Pemanggil jarak jauh hanya mengendalikan SSH_ORIGINAL_COMMAND. Bendera
    // yang ikut dikirim di sana, atau yang entah bagaimana ikut jadi argumen
    // posisi, tetap diabaikan selama skrip dipanggil lewat forced command.
    expect(
      parseInput([], `${SHA_SAH} ${FLAG_TANPA_CADANGAN}`).isBackupBypassAllowed,
    ).toBe(false);
    expect(
      parseInput([SHA_SAH, FLAG_TANPA_CADANGAN], `${SHA_SAH} ${FLAG_TANPA_CADANGAN}`)
        .isBackupBypassAllowed,
    ).toBe(false);
  });

  it("menyediakan override darurat hanya untuk pemanggilan manual di host", () => {
    expect(parseInput([SHA_SAH, FLAG_TANPA_CADANGAN])).toEqual({
      isAccepted: true,
      sha: SHA_SAH,
      isBackupBypassAllowed: true,
    });
    expect(parseInput([SHA_SAH]).isBackupBypassAllowed).toBe(false);
  });

  it("tidak menyalakan override dari tempat lain selain penguraian masukan", () => {
    // Nilai awalnya ditetapkan tanpa syarat, jadi env pemanggil tidak bisa
    // menyelundupkannya; dan satu-satunya penyalaan ada di jalur manual.
    const kode = stripCommentLines(readDeployScript());
    const penetapan = kode.match(/IZIN_TANPA_CADANGAN=\S+/g) ?? [];

    expect(penetapan).toEqual([
      "IZIN_TANPA_CADANGAN=false",
      "IZIN_TANPA_CADANGAN=true",
    ]);
    expect(stripCommentLines(readInputParsing())).toContain(
      "IZIN_TANPA_CADANGAN=true",
    );
    expect(kode).not.toContain("${IZIN_TANPA_CADANGAN:-");
  });
});

describe("skrip deploy berjalan ketat dan satu per satu", () => {
  it("memakai set -euo pipefail sebelum perintah apa pun", () => {
    const kode = stripCommentLines(readDeployScript())
      .split("\n")
      .filter((baris) => baris.trim() !== "" && !baris.startsWith("#!"));

    expect(kode[0]).toBe("set -euo pipefail");
  });

  it("mengambil kunci flock yang ditunggu sebelum menyentuh API atau cluster", () => {
    const script = readDeployScript();
    const indeksFlock = script.search(/^flock 9$/m);

    expect(script).toMatch(/^exec 9> "\$\{BERKAS_KUNCI\}"$/m);
    // Ditunggu, bukan ditolak: dua push beruntun sama-sama harus sampai.
    expect(indeksFlock).toBeGreaterThan(-1);
    expect(script).not.toMatch(/flock -n/);
    expect(indeksFlock).toBeLessThan(deployScriptSectionIndex("1."));
  });
});

describe("commit, tag, dan manifes diturunkan skrip sendiri", () => {
  it("memverifikasi commit sebagai leluhur main lewat compare API", () => {
    // Commit dari fork juga terjangkau lewat URL repo induk, jadi keberadaan
    // commit saja tidak cukup.
    const bagian = readDeployScriptSection("1.");

    expect(readDeployScript()).toMatch(/^CABANG_PRODUKSI="main"$/m);
    expect(bagian).toContain('api_github "compare/${SHA}...${CABANG_PRODUKSI}"');
    expect(bagian).toContain(`jq -r '.status + " " + (.behind_by|tostring)'`);
  });

  it.each([
    ["ahead 0", true],
    ["identical 0", true],
    ["behind 1", false],
    ["diverged 2", false],
    ["ahead 1", false],
    ["", false],
    ["null null", false],
  ])("status compare %j diterima: %s", (status, isAccepted) => {
    expect(isCompareStatusAccepted(status)).toBe(isAccepted);
  });

  it("menurunkan tag image dari API commit, bukan dari masukan", () => {
    const script = stripCommentLines(readDeployScript());

    expect(script).toContain(
      `TANGGAL_COMMIT="$(api_github "commits/\${SHA}" | jq -r '.commit.committer.date')"`,
    );
    expect(script).toContain('EPOCH_COMMIT="$(date -u -d "${TANGGAL_COMMIT}" +%s)"');
    // Tag hanya ditetapkan sekali, dari SHA yang sudah divalidasi.
    expect(script.match(/^\s*TAG=.*$/gm)).toEqual([
      'TAG="${SHA:0:12}-${EPOCH_COMMIT}"',
    ]);
    for (const nama of ["APP", "CRON", "RADIUS"]) {
      expect(script).toMatch(
        new RegExp(`^${nama}_IMAGE="\\$\\{REGISTRY\\}/netmanager-${nama.toLowerCase()}:\\$\\{TAG\\}"$`, "m"),
      );
    }
  });

  it("memakai rumus tag yang sama dengan job build", () => {
    // Rumus berbeda berarti deploy mencari tag yang tidak pernah dibuat:
    // 12 karakter pertama SHA + epoch COMMITTER (bukan author).
    const build = readWorkflowJob("build");

    expect(build).toContain(
      'VERSION="$(echo "${GITHUB_SHA}" | cut -c1-12)-$(git show -s --format=%ct HEAD)"',
    );
    expect(readDeployScript()).toContain("${SHA:0:12}");
  });

  it("memakai registry dan namespace image yang sama dengan workflow", () => {
    const workflow = readBuildWorkflow();
    const registry = workflow.match(/^ {2}REGISTRY: (\S+)$/m)?.[1];
    const namespace = workflow.match(/^ {2}IMAGE_NAMESPACE: (\S+)$/m)?.[1];
    const repoGithub = readDeployScript().match(/^REPO_GITHUB="([^"]+)"$/m)?.[1];

    expect(registry).toBeDefined();
    expect(namespace).toBeDefined();
    expect(readDeployScript()).toContain(`REGISTRY="${registry}/${namespace}"`);
    expect(repoGithub?.split("/")[0].toLowerCase()).toBe(namespace);
  });

  it("mengambil manifes dari codeload pada SHA itu, bukan dari pemanggil", () => {
    const bagian = readDeployScriptSection("3.");
    const kode = stripCommentLines(readDeployScript());

    expect(bagian).toContain(
      '"https://codeload.github.com/${REPO_GITHUB}/tar.gz/${SHA}"',
    );
    expect(bagian).toContain(
      '[ -f "${KERJA}/k8s/migration-job.yaml" ] || gagal',
    );
    // Yang di-apply hanya hasil render dari arsip itu; tidak ada manifes dari
    // stdin atau dari berkas lain di host.
    const apply = kode.match(/apply -f \S+/g) ?? [];
    expect(apply).toEqual([
      'apply -f "${KERJA}/rendered/migration-job.yaml"',
      'apply -f "$manifest"',
    ]);
    expect(kode).toContain('for manifest in "${KERJA}"/rendered/*.yaml; do');
  });
});

const IMAGE_APP_UJI = "ghcr.io/uji/netmanager-app:abc-1";

/**
 * Jalankan render manifes skrip yang sesungguhnya atas pohon `k8s/` palsu.
 * `manifests` berisi nama berkas di `k8s/production/` beserta isinya;
 * keluarannya daftar berkas hasil render beserta isinya.
 */
function runRender(manifests: Record<string, string>) {
  const bagian = readDeployScriptSection("3.");
  const mulai = bagian.indexOf('mkdir -p "${KERJA}/rendered"');
  expect(mulai).toBeGreaterThan(-1);

  const tulisManifes = Object.entries(manifests)
    .map(([nama, isi]) => `printf '%s\\n' '${isi}' > "\${KERJA}/k8s/production/${nama}"`)
    .join("\n");
  return runBash(
    [
      'gagal() { echo "GAGAL: $*"; exit 1; }',
      'KERJA="$(mktemp -d)"',
      `trap 'rm -rf "\${KERJA}"' EXIT`,
      'mkdir -p "${KERJA}/k8s/production"',
      `printf '%s\\n' 'image: {{APP_IMAGE}}' > "\${KERJA}/k8s/migration-job.yaml"`,
      tulisManifes,
      bagian.slice(mulai),
      'for berkas in "${KERJA}"/rendered/*; do echo "== $(basename "$berkas")"; cat "$berkas"; done',
    ].join("\n"),
    {
      APP_IMAGE: IMAGE_APP_UJI,
      CRON_IMAGE: "ghcr.io/uji/netmanager-cron:abc-1",
      RADIUS_IMAGE: "ghcr.io/uji/netmanager-radius:abc-1",
      NAMESPACE: "netmanager-production",
    },
  );
}

describe("render manifes", () => {
  it("merender image dan melewati template secret (perilaku)", () => {
    const hasil = runRender({
      "deployment.yaml": "image: {{APP_IMAGE}}",
      "secrets.yaml": "CRON_SECRET: REPLACE_WITH_REAL_SECRET_BEFORE_DEPLOY",
      "registry-secret.yaml": "password: contoh",
    });

    expect(hasil.isSuccess).toBe(true);
    expect(hasil.stdout).toContain(`== deployment.yaml\nimage: ${IMAGE_APP_UJI}`);
    expect(hasil.stdout).toContain(`== migration-job.yaml\nimage: ${IMAGE_APP_UJI}`);
    expect(hasil.stdout).not.toContain("== secrets.yaml");
    expect(hasil.stdout).not.toContain("== registry-secret.yaml");
  });

  it("menolak hasil render yang masih menyisakan placeholder (perilaku)", () => {
    // Placeholder yang tidak dikenal sed tetap tersisa; menerapkannya membuat
    // Kubernetes menarik image bernama harfiah "{{APP_IMAGE}}".
    // Pemeriksaannya dijalankan sendiri atas direktori render yang sengaja
    // masih memuat placeholder, karena render yang sehat tidak pernah
    // menyisakannya.
    const bagian = readDeployScriptSection("3.");
    const mulai = bagian.indexOf("if grep -rlF");
    const selesai = bagian.indexOf("\nfi", mulai);
    expect(mulai).toBeGreaterThan(-1);
    const pemeriksaan = bagian.slice(mulai, selesai + "\nfi".length);

    const periksa = (isi: string) =>
      runBash(
        [
          'gagal() { echo "GAGAL: $*"; exit 1; }',
          'KERJA="$(mktemp -d)"',
          `trap 'rm -rf "\${KERJA}"' EXIT`,
          'mkdir -p "${KERJA}/rendered"',
          `printf '%s\\n' '${isi}' > "\${KERJA}/rendered/deployment.yaml"`,
          pemeriksaan,
        ].join("\n"),
      ).isSuccess;

    expect(periksa(`image: ${IMAGE_APP_UJI}`)).toBe(true);
    for (const placeholder of ["{{APP_IMAGE}}", "{{CRON_IMAGE}}", "{{RADIUS_IMAGE}}"]) {
      expect(periksa(`image: ${placeholder}`), placeholder).toBe(false);
    }
  });

  it("tidak pernah menerapkan template secret placeholder dari repo", () => {
    // `secrets.yaml` dan `registry-secret.yaml` berisi nilai contoh.
    // Menerapkannya menimpa secret hidup di cluster dengan placeholder.
    expect(readDeployScriptSection("3.")).toContain(
      "secrets.yaml|registry-secret.yaml) continue ;;",
    );
  });

  it("merender ke berkas dan menolak placeholder yang tersisa", () => {
    const bagian = readDeployScriptSection("3.");

    expect(bagian).toContain('> "${KERJA}/rendered/$(basename "$manifest")"');
    expect(bagian).toContain(
      `grep -rlF -e '{{APP_IMAGE}}' -e '{{CRON_IMAGE}}' -e '{{RADIUS_IMAGE}}' "\${KERJA}/rendered/"`,
    );
    expect(bagian).toContain('gagal "Render manifes menyisakan placeholder"');
  });
});

describe("image tersedia sebelum cluster disentuh", () => {
  it("memeriksa ketiga image dengan kredensial pull cluster sendiri", () => {
    // Yang lolos di sini pasti bisa ditarik kubelet — bukan ImagePullBackOff
    // setelah apply.
    const bagian = readDeployScriptSection("4.");

    expect(bagian).toContain(
      `get secret "\${NAMESPACE}-registry" -o jsonpath='{.data.\\.dockerconfigjson}'`,
    );
    expect(bagian).toContain('curl -fsS -u "${KREDENSIAL_PULL}"');
    expect(bagian).toContain("/manifests/${TAG}");
    expect(bagian).toContain(
      "for nama in netmanager-app netmanager-cron netmanager-radius; do",
    );
    expect(bagian).toContain('image_tersedia "${nama}" || gagal');
  });

  it("berjalan sebelum preflight, cadangan, dan migrasi", () => {
    expect(deployScriptSectionIndex("4.")).toBeLessThan(
      deployScriptSectionIndex("5."),
    );
    expect(deployScriptSectionIndex("4.")).toBeLessThan(
      deployScriptSectionIndex("7."),
    );
  });
});

describe("menunggu migrasi", () => {
  /** Jalankan bagian migrasi skrip dengan kondisi Job palsu. */
  function runMigrationWait(env: Record<string, string>) {
    return runBash(
      [KUBECTL_PALSU, readDeployScriptSection("7.")].join("\n"),
      { BATAS_TUNGGU_MIGRASI_DETIK: "3900", ...env },
    );
  }

  it("memantau Complete dan Failed sekaligus, tanpa kubectl wait", () => {
    // `kubectl wait --for=condition=complete` tidak pernah kembali saat Job
    // gagal. Pada 2026-09-18 guard menolak migrasi destruktif dalam hitungan
    // detik, tetapi pipeline tetap menggantung 40+ menit.
    const bagian = readDeployScriptSection("7.");

    expect(bagian).toContain('{.status.conditions[?(@.type=="Complete")].status}');
    expect(bagian).toContain('{.status.conditions[?(@.type=="Failed")].status}');
    expect(readDeployScript()).not.toContain("wait --for=condition=complete");
  });

  it("langsung gagal begitu Job berkondisi Failed", () => {
    const hasil = runMigrationWait({ KONDISI_FAILED: "True" });

    expect(hasil.isSuccess).toBe(false);
    expect(hasil.stdout).toContain("GAGAL: Migrasi gagal");
  });

  it("lanjut begitu Job berkondisi Complete", () => {
    const hasil = runMigrationWait({ KONDISI_COMPLETE: "True" });

    expect(hasil.isSuccess).toBe(true);
    expect(hasil.stdout).toContain("Migrasi selesai.");
  });

  it("gagal setelah batas tunggu habis tanpa kondisi akhir", () => {
    const hasil = runMigrationWait({ BATAS_TUNGGU_MIGRASI_DETIK: "0" });

    expect(hasil.isSuccess).toBe(false);
  });
});

describe("verifikasi setelah rollout", () => {
  /** Jalankan bagian apply + rollout + verifikasi dengan image aktif palsu. */
  function runRolloutCheck(imageAktif: string, imageHarusnya: string) {
    return runBash(
      [KUBECTL_PALSU, readDeployScriptSection("8.")].join("\n"),
      { IMAGE_AKTIF: imageAktif, APP_IMAGE: imageHarusnya, BATAS_ROLLOUT: "420s" },
    );
  }

  it("menunggu rollout keempat deployment", () => {
    const bagian = readDeployScriptSection("8.");

    expect(bagian).toContain(
      "for deployment in netmanager-app netmanager-worker netmanager-cron netmanager-radius; do",
    );
    expect(bagian).toContain('rollout status "deploy/${deployment}"');
  });

  it("gagal bila image yang benar-benar aktif bukan image commit ini", () => {
    // Rollout bisa dilaporkan sukses padahal manifes lama yang terpasang.
    expect(runRolloutCheck("registry/app:baru", "registry/app:baru").isSuccess).toBe(true);
    expect(runRolloutCheck("registry/app:lama", "registry/app:baru").isSuccess).toBe(false);
  });
});
