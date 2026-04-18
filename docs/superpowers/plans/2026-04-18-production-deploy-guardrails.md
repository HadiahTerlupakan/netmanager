# Production Deploy Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mencegah deploy production drift, short-name image, dan recovery manual Rancher dengan tetap mempertahankan alur `staging -> deploy-prod.sh -> main -> Jenkins production`.

**Architecture:** `deploy-prod.sh` tetap menjadi promotion-only script yang mendorong `origin/staging` ke `main`. Jenkins production menjadi gerbang tunggal deploy dengan guardrail render image, validasi registry path, anti-drift check berbasis annotation+image aktif, dan recovery mode resmi yang memakai image known-good dari registry resmi.

**Tech Stack:** Bash, Jenkins Pipeline (Groovy), Kubernetes manifests, Vitest string-based CI safety tests, Markdown documentation.

---

## File Structure

- **Modify:** `deploy-prod.sh` — mempertegas script sebagai promotion-only flow, menampilkan SHA promosi, dan mengarahkan operator ke Jenkins production untuk status deploy.
- **Modify:** `Jenkinsfile` — menambah mode deploy normal vs recovery, validasi rendered image refs, annotation contract, anti-drift checks, dan flow recovery resmi tanpa Rancher.
- **Modify:** `k8s/production/app-deployment.yaml` — menambahkan annotation contract pada pod template untuk image ref resmi app.
- **Modify:** `k8s/production/cron-deployment.yaml` — menambahkan annotation contract pada pod template untuk image ref resmi cron.
- **Modify:** `k8s/production/radius-deployment.yaml` — menambahkan annotation contract pada pod template untuk image ref resmi radius.
- **Create:** `tests/ci/deploy-prod-script-safety.test.ts` — regression tests untuk kontrak promotion-only `deploy-prod.sh`.
- **Modify:** `tests/ci/jenkinsfile-build-safety.test.ts` — regression tests untuk render validation dan parameter/mode recovery di Jenkins.
- **Modify:** `tests/ci/jenkinsfile-deploy-safety.test.ts` — regression tests untuk anti-drift dan apply flow production.
- **Create:** `tests/ci/jenkinsfile-recovery-safety.test.ts` — regression tests untuk recovery mode Jenkins production.
- **Modify:** `DEPLOYMENT.md` — dokumentasi operasional deploy production, policy tanpa manual Rancher, bootstrap secret registry, dan recovery resmi.

---

### Task 1: Kunci `deploy-prod.sh` sebagai promotion-only script

**Files:**
- Modify: `deploy-prod.sh`
- Test: `tests/ci/deploy-prod-script-safety.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readDeployProdScript(): string {
  return readFileSync(resolve(process.cwd(), "deploy-prod.sh"), "utf8");
}

describe("deploy-prod.sh safety", () => {
  it("treats the script as promotion-only and prints the promoted staging SHA", () => {
    const script = readDeployProdScript();

    expect(script).toContain('PROMOTION_SHA="$(git rev-parse origin/staging)"');
    expect(script).toContain('echo "Promoting commit ${PROMOTION_SHA} from origin/staging to main..."');
    expect(script).toContain('echo -e "${GREEN}Git promotion selesai.${NC}"');
    expect(script).toContain('echo -e "${YELLOW}Deploy production resmi berjalan di Jenkins job branch main.${NC}"');
    expect(script).toContain('echo -e "${YELLOW}Pantau hasil akhir deploy di Jenkins production sebelum menganggap production sehat.${NC}"');
    expect(script).not.toContain('Production deployment successful');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/ci/deploy-prod-script-safety.test.ts`
Expected: FAIL karena `deploy-prod.sh` belum punya `PROMOTION_SHA` dan pesan promotion-only yang eksplisit.

- [ ] **Step 3: Write the minimal implementation**

Tambahkan blok berikut ke `deploy-prod.sh` setelah `git pull --ff-only origin staging` dan ganti pesan akhir:

```bash
PROMOTION_SHA="$(git rev-parse origin/staging)"
echo "Promoting commit ${PROMOTION_SHA} from origin/staging to main..."
```

```bash
echo -e "${GREEN}Git promotion selesai.${NC}"
echo -e "${YELLOW}Deploy production resmi berjalan di Jenkins job branch main.${NC}"
echo -e "${YELLOW}Pantau hasil akhir deploy di Jenkins production sebelum menganggap production sehat.${NC}"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- tests/ci/deploy-prod-script-safety.test.ts`
Expected: PASS dengan `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add deploy-prod.sh tests/ci/deploy-prod-script-safety.test.ts
git commit -m "fix: clarify production promotion flow"
```

---

### Task 2: Tambahkan annotation contract pada manifest production

**Files:**
- Modify: `k8s/production/app-deployment.yaml`
- Modify: `k8s/production/cron-deployment.yaml`
- Modify: `k8s/production/radius-deployment.yaml`
- Test: `tests/ci/jenkinsfile-build-safety.test.ts`

- [ ] **Step 1: Write the failing test**

Tambahkan test berikut ke `tests/ci/jenkinsfile-build-safety.test.ts`:

```ts
it("keeps production deployment manifests annotated with the rendered official image ref", () => {
  const appManifest = readManifest("k8s/production/app-deployment.yaml");
  const cronManifest = readManifest("k8s/production/cron-deployment.yaml");
  const radiusManifest = readManifest("k8s/production/radius-deployment.yaml");

  expect(appManifest).toContain('deploy.radpro.id/managed-by: "jenkins"');
  expect(appManifest).toContain('deploy.radpro.id/image-ref: "{{APP_IMAGE}}"');

  expect(cronManifest).toContain('deploy.radpro.id/managed-by: "jenkins"');
  expect(cronManifest).toContain('deploy.radpro.id/image-ref: "{{CRON_IMAGE}}"');

  expect(radiusManifest).toContain('deploy.radpro.id/managed-by: "jenkins"');
  expect(radiusManifest).toContain('deploy.radpro.id/image-ref: "{{RADIUS_IMAGE}}"');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/ci/jenkinsfile-build-safety.test.ts`
Expected: FAIL karena annotation `deploy.radpro.id/*` belum ada di manifest production.

- [ ] **Step 3: Write the minimal implementation**

Tambahkan `annotations` pada `template.metadata` di tiga manifest berikut.

Untuk `k8s/production/app-deployment.yaml`:

```yaml
      annotations:
        deploy.radpro.id/managed-by: "jenkins"
        deploy.radpro.id/image-ref: "{{APP_IMAGE}}"
```

Untuk `k8s/production/cron-deployment.yaml`:

```yaml
      annotations:
        deploy.radpro.id/managed-by: "jenkins"
        deploy.radpro.id/image-ref: "{{CRON_IMAGE}}"
```

Untuk `k8s/production/radius-deployment.yaml`:

```yaml
      annotations:
        deploy.radpro.id/managed-by: "jenkins"
        deploy.radpro.id/image-ref: "{{RADIUS_IMAGE}}"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- tests/ci/jenkinsfile-build-safety.test.ts`
Expected: PASS dan tidak ada assertion manifest annotation yang gagal.

- [ ] **Step 5: Commit**

```bash
git add k8s/production/app-deployment.yaml k8s/production/cron-deployment.yaml k8s/production/radius-deployment.yaml tests/ci/jenkinsfile-build-safety.test.ts
git commit -m "fix: annotate production workloads with official image refs"
```

---

### Task 3: Validasi rendered image refs sebelum apply production

**Files:**
- Modify: `Jenkinsfile`
- Modify: `tests/ci/jenkinsfile-build-safety.test.ts`

- [ ] **Step 1: Write the failing test**

Tambahkan test berikut ke `tests/ci/jenkinsfile-build-safety.test.ts`:

```ts
it("renders deployment manifests to files and rejects non-registry image refs", () => {
  const jenkinsfile = readJenkinsfile();

  expect(jenkinsfile).toContain('validate_image_ref() {');
  expect(jenkinsfile).toContain('case "$image_ref" in');
  expect(jenkinsfile).toContain('"${REGISTRY_PATH}/"* )');
  expect(jenkinsfile).toContain('echo "❌ Image ref untuk $workload harus memakai registry resmi: $image_ref" >&2');
  expect(jenkinsfile).toContain('render_manifest_to_file() {');
  expect(jenkinsfile).toContain('grep -q "{{APP_IMAGE}}\|{{CRON_IMAGE}}\|{{RADIUS_IMAGE}}" "$rendered_manifest"');
  expect(jenkinsfile).toContain('kubectl apply -f "$rendered_manifest"');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/ci/jenkinsfile-build-safety.test.ts`
Expected: FAIL karena helper `validate_image_ref` dan `render_manifest_to_file` belum ada.

- [ ] **Step 3: Write the minimal implementation**

Di stage `Deploy to K8s` dalam `Jenkinsfile`, tambahkan helper berikut sebelum loop apply:

```groovy
validate_image_ref() {
  local workload="$1"
  local image_ref="$2"

  case "$image_ref" in
    "${REGISTRY_PATH}/"* )
      ;;
    *)
      echo "❌ Image ref untuk $workload harus memakai registry resmi: $image_ref" >&2
      exit 1
      ;;
  esac
}

render_manifest_to_file() {
  local manifest="$1"
  local rendered_manifest="$2"

  sed \
    -e 's|{{APP_IMAGE}}|${env.APP_IMAGE_REF}|g' \
    -e 's|{{CRON_IMAGE}}|${env.CRON_IMAGE_REF}|g' \
    -e 's|{{RADIUS_IMAGE}}|${env.RADIUS_IMAGE_REF}|g' \
    "$manifest" > "$rendered_manifest"

  if grep -q "{{APP_IMAGE}}\|{{CRON_IMAGE}}\|{{RADIUS_IMAGE}}" "$rendered_manifest"; then
    echo "❌ Render manifest masih menyisakan placeholder pada $manifest" >&2
    exit 1
  fi
}
```

Lalu sebelum loop apply tambahkan validasi:

```groovy
validate_image_ref netmanager-app "${env.APP_IMAGE_REF}"
validate_image_ref netmanager-cron "${env.CRON_IMAGE_REF}"
validate_image_ref netmanager-radius "${env.RADIUS_IMAGE_REF}"
```

Dan ubah apply loop deployment menjadi file-based render:

```groovy
rendered_manifest="$(mktemp)"
render_manifest_to_file "$manifest" "$rendered_manifest"
kubectl apply -f "$rendered_manifest"
rm -f "$rendered_manifest"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- tests/ci/jenkinsfile-build-safety.test.ts`
Expected: PASS dan output Vitest menunjukkan seluruh build safety assertions lulus.

- [ ] **Step 5: Commit**

```bash
git add Jenkinsfile tests/ci/jenkinsfile-build-safety.test.ts
git commit -m "fix: validate rendered production image refs"
```

---

### Task 4: Tambahkan anti-drift check sebelum rollout production

**Files:**
- Modify: `Jenkinsfile`
- Modify: `tests/ci/jenkinsfile-deploy-safety.test.ts`

- [ ] **Step 1: Write the failing test**

Tambahkan test berikut ke `tests/ci/jenkinsfile-deploy-safety.test.ts`:

```ts
it("blocks production rollout when the active deployment image drifts from the Jenkins annotation contract", () => {
  const jenkinsfile = readJenkinsfile();

  expect(jenkinsfile).toContain('assert_cluster_image_contract() {');
  expect(jenkinsfile).toContain('local expected_annotation="deploy.radpro.id/image-ref"');
  expect(jenkinsfile).toContain('kubectl get deployment "$deployment_name" -n ${NAMESPACE} -o jsonpath=');
  expect(jenkinsfile).toContain('current_annotation="$(kubectl get deployment "$deployment_name" -n ${NAMESPACE} -o jsonpath="{.spec.template.metadata.annotations.deploy\\.radpro\\.id/image-ref}")"');
  expect(jenkinsfile).toContain('if [ "$current_annotation" != "$current_image" ]; then');
  expect(jenkinsfile).toContain('echo "❌ Drift terdeteksi pada deployment/$deployment_name: image aktif $current_image tidak cocok dengan annotation $current_annotation" >&2');
  expect(jenkinsfile).toContain('if [ "${NAMESPACE}" = "netmanager-production" ]; then');
  expect(jenkinsfile).toContain('assert_cluster_image_contract netmanager-app app');
  expect(jenkinsfile).toContain('assert_cluster_image_contract netmanager-cron cron');
  expect(jenkinsfile).toContain('assert_cluster_image_contract netmanager-radius radius');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/ci/jenkinsfile-deploy-safety.test.ts`
Expected: FAIL karena fungsi `assert_cluster_image_contract` belum ada.

- [ ] **Step 3: Write the minimal implementation**

Di stage `Deploy to K8s` dalam `Jenkinsfile`, tambahkan helper berikut:

```groovy
assert_cluster_image_contract() {
  local deployment_name="$1"
  local container_name="$2"
  local expected_annotation="deploy.radpro.id/image-ref"
  local current_image
  local current_annotation

  current_image="$(get_current_image "$deployment_name" "$container_name")"

  if [ -z "$current_image" ]; then
    echo "ℹ️ deployment/$deployment_name belum punya image aktif; skip drift check"
    return 0
  fi

  current_annotation="$(kubectl get deployment "$deployment_name" -n ${NAMESPACE} -o jsonpath="{.spec.template.metadata.annotations.deploy\.radpro\.id/image-ref}")"

  validate_image_ref "$deployment_name" "$current_image"

  if [ "$current_annotation" != "$current_image" ]; then
    echo "❌ Drift terdeteksi pada deployment/$deployment_name: image aktif $current_image tidak cocok dengan annotation $current_annotation" >&2
    exit 1
  fi
}
```

Lalu panggil hanya untuk production sebelum `kubectl apply` loop:

```groovy
if [ "${NAMESPACE}" = "netmanager-production" ]; then
  assert_cluster_image_contract netmanager-app app
  assert_cluster_image_contract netmanager-cron cron
  assert_cluster_image_contract netmanager-radius radius
fi
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- tests/ci/jenkinsfile-deploy-safety.test.ts`
Expected: PASS dan deploy safety assertions tetap hijau.

- [ ] **Step 5: Commit**

```bash
git add Jenkinsfile tests/ci/jenkinsfile-deploy-safety.test.ts
git commit -m "fix: block production rollout on cluster drift"
```

---

### Task 5: Tambahkan recovery mode resmi di Jenkins

**Files:**
- Modify: `Jenkinsfile`
- Create: `tests/ci/jenkinsfile-recovery-safety.test.ts`

- [ ] **Step 1: Write the failing test**

Buat file `tests/ci/jenkinsfile-recovery-safety.test.ts` dengan isi berikut:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readJenkinsfile(): string {
  return readFileSync(resolve(process.cwd(), "Jenkinsfile"), "utf8");
}

describe("Jenkinsfile recovery safety", () => {
  it("supports an explicit recovery mode with registry-validated image overrides", () => {
    const jenkinsfile = readJenkinsfile();

    expect(jenkinsfile).toContain("parameters {");
    expect(jenkinsfile).toContain("choice(name: 'DEPLOY_MODE', choices: ['normal', 'recovery']");
    expect(jenkinsfile).toContain("string(name: 'RECOVERY_APP_IMAGE'");
    expect(jenkinsfile).toContain("string(name: 'RECOVERY_CRON_IMAGE'");
    expect(jenkinsfile).toContain("string(name: 'RECOVERY_RADIUS_IMAGE'");
    expect(jenkinsfile).toContain("env.DEPLOY_MODE = \"${params.DEPLOY_MODE ?: 'normal'}\"");
    expect(jenkinsfile).toContain("resolve_deploy_image_ref('netmanager-app', env.APP_IMAGE_REF, params.RECOVERY_APP_IMAGE)");
    expect(jenkinsfile).toContain("resolve_deploy_image_ref('netmanager-cron', env.CRON_IMAGE_REF, params.RECOVERY_CRON_IMAGE)");
    expect(jenkinsfile).toContain("resolve_deploy_image_ref('netmanager-radius', env.RADIUS_IMAGE_REF, params.RECOVERY_RADIUS_IMAGE)");
    expect(jenkinsfile).toContain("if (env.DEPLOY_MODE == 'recovery' && env.BRANCH_NAME != 'main') {");
    expect(jenkinsfile).toContain("error('Recovery mode hanya boleh dijalankan untuk branch main.')");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/ci/jenkinsfile-recovery-safety.test.ts`
Expected: FAIL karena parameter `DEPLOY_MODE` dan helper recovery belum ada.

- [ ] **Step 3: Write the minimal implementation**

Tambahkan `parameters` block di awal `pipeline`:

```groovy
parameters {
  choice(name: 'DEPLOY_MODE', choices: ['normal', 'recovery'], description: 'normal = build+deploy biasa, recovery = deploy known-good image tanpa build baru')
  string(name: 'RECOVERY_APP_IMAGE', defaultValue: '', description: 'Immutable image ref app untuk recovery production')
  string(name: 'RECOVERY_CRON_IMAGE', defaultValue: '', description: 'Immutable image ref cron untuk recovery production')
  string(name: 'RECOVERY_RADIUS_IMAGE', defaultValue: '', description: 'Immutable image ref radius untuk recovery production')
}
```

Di `Validate Registry Configuration`, tambahkan state dan helper:

```groovy
env.DEPLOY_MODE = "${params.DEPLOY_MODE ?: 'normal'}"

def resolveDeployImageRef = { String workload, String defaultRef, String recoveryOverride ->
    def trimmedOverride = (recoveryOverride ?: '').trim()

    if (env.DEPLOY_MODE != 'recovery') {
        return defaultRef
    }

    requireValue(trimmedOverride, "Recovery mode mewajibkan image override untuk ${workload}.")

    if (!trimmedOverride.startsWith("${env.REGISTRY_PATH}/")) {
        error("Recovery image untuk ${workload} harus memakai registry resmi: ${trimmedOverride}")
    }

    return trimmedOverride
}

if (env.DEPLOY_MODE == 'recovery' && env.BRANCH_NAME != 'main') {
    error('Recovery mode hanya boleh dijalankan untuk branch main.')
}

env.APP_DEPLOY_REF = resolveDeployImageRef('netmanager-app', env.APP_IMAGE_REF, params.RECOVERY_APP_IMAGE)
env.CRON_DEPLOY_REF = resolveDeployImageRef('netmanager-cron', env.CRON_IMAGE_REF, params.RECOVERY_CRON_IMAGE)
env.RADIUS_DEPLOY_REF = resolveDeployImageRef('netmanager-radius', env.RADIUS_IMAGE_REF, params.RECOVERY_RADIUS_IMAGE)
```

Lalu gate stage build/push/migration normal dengan `when` expression:

```groovy
when {
  expression { env.DEPLOY_MODE != 'recovery' }
}
```

Dan di stage deploy gunakan `env.APP_DEPLOY_REF`, `env.CRON_DEPLOY_REF`, `env.RADIUS_DEPLOY_REF` menggantikan target deploy image ref.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- tests/ci/jenkinsfile-recovery-safety.test.ts`
Expected: PASS dengan `1 passed`.

- [ ] **Step 5: Run focused Jenkinsfile regression tests**

Run: `npm run test:run -- tests/ci/jenkinsfile-build-safety.test.ts tests/ci/jenkinsfile-deploy-safety.test.ts tests/ci/jenkinsfile-recovery-safety.test.ts`
Expected: PASS dan tidak ada regression pada Jenkinsfile safety tests.

- [ ] **Step 6: Commit**

```bash
git add Jenkinsfile tests/ci/jenkinsfile-recovery-safety.test.ts tests/ci/jenkinsfile-build-safety.test.ts tests/ci/jenkinsfile-deploy-safety.test.ts
git commit -m "feat: add official production recovery mode"
```

---

### Task 6: Dokumentasikan SOP deploy production dan recovery resmi

**Files:**
- Modify: `DEPLOYMENT.md`
- Test: none

- [ ] **Step 1: Write the documentation changes**

Perbarui bagian production di `DEPLOYMENT.md` dengan poin berikut:

```md
## Aturan Operasional Production

- Production hanya boleh berubah melalui Jenkins production.
- `deploy-prod.sh` hanya mempromosikan `origin/staging` ke `main`.
- Rancher/kubectl manual bukan jalur deploy atau recovery yang sah.
- Jika Jenkins production gagal karena drift atau missing secret, selesaikan lewat guardrail resmi dan rerun Jenkins.
```

Tambahkan bagian recovery resmi:

```md
## Recovery Production Resmi

Gunakan Jenkins job recovery production dengan `DEPLOY_MODE=recovery`.
Isi image immutable yang known-good untuk:
- `RECOVERY_APP_IMAGE`
- `RECOVERY_CRON_IMAGE`
- `RECOVERY_RADIUS_IMAGE`

Syarat recovery:
- branch/job mengarah ke `main`
- image memakai registry resmi
- secret `netmanager-production-registry` tersedia
- jangan gunakan patch manual dari Rancher
```

Tambahkan bagian bootstrap secret registry production:

```md
## Bootstrap Secret Registry Production

```bash
kubectl create secret docker-registry netmanager-production-registry \
  --namespace=netmanager-production \
  --docker-server=ghcr.io \
  --docker-username='<registry-username>' \
  --docker-password='<registry-token>'
```
```

- [ ] **Step 2: Manually review the rendered Markdown**

Run: `sed -n '1,260p' DEPLOYMENT.md`
Expected: Section production, secret bootstrap, dan recovery resmi terbaca jelas tanpa menyuruh operator masuk Rancher untuk patch manual.

- [ ] **Step 3: Commit**

```bash
git add DEPLOYMENT.md
git commit -m "docs: document official production deploy and recovery flow"
```

---

### Task 7: Jalankan verifikasi akhir seluruh perubahan

**Files:**
- Modify: none
- Test: `tests/ci/deploy-prod-script-safety.test.ts`
- Test: `tests/ci/jenkinsfile-build-safety.test.ts`
- Test: `tests/ci/jenkinsfile-deploy-safety.test.ts`
- Test: `tests/ci/jenkinsfile-recovery-safety.test.ts`

- [ ] **Step 1: Run the CI safety test suite**

Run: `npm run test:run -- tests/ci/deploy-prod-script-safety.test.ts tests/ci/jenkinsfile-build-safety.test.ts tests/ci/jenkinsfile-deploy-safety.test.ts tests/ci/jenkinsfile-recovery-safety.test.ts`
Expected: PASS untuk seluruh test safety deploy.

- [ ] **Step 2: Run lint on touched files if needed**

Run: `npm run lint -- deploy-prod.sh tests/ci/deploy-prod-script-safety.test.ts tests/ci/jenkinsfile-build-safety.test.ts tests/ci/jenkinsfile-deploy-safety.test.ts tests/ci/jenkinsfile-recovery-safety.test.ts`
Expected: Tidak ada error lint pada file yang disentuh. Jika CLI ESLint repo tidak menerima daftar file ini, jalankan `npm run lint` penuh.

- [ ] **Step 3: Smoke-check the promotion script output**

Run: `bash -n deploy-prod.sh`
Expected: Tidak ada syntax error shell.

- [ ] **Step 4: Commit the verification-only follow-up if fixes were needed**

```bash
git status --short
```

Expected: kosong. Jika ada perbaikan dari lint/test, commit dengan pesan:

```bash
git add deploy-prod.sh Jenkinsfile DEPLOYMENT.md tests/ci/*.ts k8s/production/*.yaml
git commit -m "chore: finish production deploy guardrails"
```

---

## Implementation Notes

- Jangan menambahkan fallback diam-diam ke short-name image.
- Jangan menambahkan jalur manual Rancher sebagai dokumentasi operasional production.
- Recovery mode harus tetap memverifikasi registry resmi dan hanya dipakai untuk branch `main`.
- Anti-drift check untuk production boleh skip saat deployment belum pernah punya image aktif, tetapi tidak boleh skip ketika image aktif ada dan annotation contract mismatch.
