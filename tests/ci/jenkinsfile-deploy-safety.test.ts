import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readJenkinsfile(): string {
  return readFileSync(resolve(process.cwd(), "Jenkinsfile"), "utf8");
}

describe("Jenkinsfile deploy safety", () => {
  it("applies namespace explicitly before migration infra resources", () => {
    const jenkinsfile = readJenkinsfile();

    const namespaceIndex = jenkinsfile.indexOf(
      "kubectl apply -f ${K8S_DIR}/namespace.yaml",
    );
    const configMapIndex = jenkinsfile.indexOf(
      "kubectl apply -f ${K8S_DIR}/configmap.yaml --namespace=${NAMESPACE}",
    );
    const dbIndex = jenkinsfile.indexOf(
      "kubectl apply -f ${K8S_DIR}/db-statefulset.yaml --namespace=${NAMESPACE}",
    );

    expect(namespaceIndex).toBeGreaterThanOrEqual(0);
    expect(configMapIndex).toBeGreaterThan(namespaceIndex);
    expect(dbIndex).toBeGreaterThan(namespaceIndex);
    expect(jenkinsfile).not.toContain(
      "configmap.yaml --namespace=${NAMESPACE} || true",
    );
    expect(jenkinsfile).not.toContain(
      "db-statefulset.yaml --namespace=${NAMESPACE} || true",
    );
    expect(jenkinsfile).not.toContain(
      "redis-deployment.yaml --namespace=${NAMESPACE} || true",
    );
    expect(jenkinsfile).not.toContain(
      "pvc.yaml --namespace=${NAMESPACE} || true",
    );
  });

  it("uses deterministic manifest apply loop instead of find-xargs apply", () => {
    const jenkinsfile = readJenkinsfile();

    expect(jenkinsfile).toContain(
      'find ${K8S_DIR}/ -maxdepth 1 -name "*.yaml" ! -name "secrets.yaml" ! -name "registry-secret.yaml" ! -name "namespace.yaml" | sort | while IFS= read -r manifest; do',
    );
    expect(jenkinsfile).not.toContain(
      'find ${K8S_DIR}/ -name "*.yaml" ! -name "secrets.yaml" | xargs -I {} kubectl apply -f {} --namespace=${NAMESPACE}',
    );
  });

  it("restarts and verifies cron rollout after applying static-tag staging manifests", () => {
    const jenkinsfile = readJenkinsfile();

    expect(jenkinsfile).toContain(
      'rollout_workload netmanager-cron "\\$CRON_PREVIOUS_IMAGE" "${env.CRON_DEPLOY_REF}"',
    );
    expect(jenkinsfile).toContain(
      'kubectl rollout restart deployment/"\\$deployment_name" --namespace=${NAMESPACE}',
    );
    expect(jenkinsfile).toContain(
      'kubectl rollout status deployment/"\\$deployment_name" --namespace=${NAMESPACE} --timeout=600s',
    );
  });

  it("does not tolerate radius rollout restart or status failures", () => {
    const jenkinsfile = readJenkinsfile();

    expect(jenkinsfile).toContain(
      'rollout_workload netmanager-radius "\\$RADIUS_PREVIOUS_IMAGE" "${env.RADIUS_DEPLOY_REF}"',
    );
    expect(jenkinsfile).not.toContain(
      'kubectl rollout restart deployment/"\\$deployment_name" --namespace=${NAMESPACE} || true',
    );
    expect(jenkinsfile).not.toContain(
      'kubectl rollout status deployment/"\\$deployment_name" --namespace=${NAMESPACE} --timeout=600s || true',
    );
  });

  it("waits for redis rollout after applying deployment manifests", () => {
    const jenkinsfile = readJenkinsfile();

    expect(jenkinsfile).toContain(
      "kubectl rollout status deployment/netmanager-redis --namespace=${NAMESPACE} --timeout=300s",
    );
    expect(jenkinsfile).not.toContain(
      "kubectl rollout status deployment/netmanager-redis --namespace=${NAMESPACE} --timeout=300s || true",
    );
  });

  it("handles kubectl get deployment failures with an explicit snapshot-read warning", () => {
    const jenkinsfile = readJenkinsfile();
    const deployStageIndex = jenkinsfile.indexOf("stage('Deploy to K8s')");
    const deployBlock = jenkinsfile.slice(deployStageIndex);
    const snapshotFunctionStart = deployBlock.indexOf("get_current_image() {");
    const snapshotFunctionEnd = deployBlock.indexOf("validate_image_ref() {");
    const snapshotFunctionBlock = deployBlock.slice(
      snapshotFunctionStart,
      snapshotFunctionEnd,
    );
    const snapshotBlockIndex = deployBlock.indexOf(
      'APP_PREVIOUS_IMAGE="\\$(get_current_image netmanager-app app)"',
    );

    expect(deployStageIndex).toBeGreaterThanOrEqual(0);
    expect(snapshotFunctionStart).toBeGreaterThanOrEqual(0);
    expect(snapshotFunctionEnd).toBeGreaterThan(snapshotFunctionStart);
    expect(snapshotFunctionBlock).toContain(
      'if ! deployment_snapshot="\\$(kubectl get deployment "\\$deployment_name" -n ${NAMESPACE} -o jsonpath=\'{range .spec.template.spec.containers[*]}{.name}={.image}{"\\\\n"}{end}\')"; then',
    );
    expect(snapshotFunctionBlock).toContain(
      'echo "⚠️ Gagal membaca snapshot image dari deployment/\\$deployment_name container/\\$container_name; lanjutkan tanpa snapshot" >&2',
    );
    expect(snapshotFunctionBlock).toContain(
      'kubectl get deployment "\\$deployment_name"',
    );
    expect(snapshotFunctionBlock).toContain(
      'awk -F= -v name="\\$container_name"',
    );
    expect(snapshotFunctionBlock).not.toContain("2>/dev/null || true");
    expect(snapshotFunctionBlock).toContain(
      'echo "⚠️ Tidak ada snapshot image sebelumnya untuk deployment/\\$deployment_name container/\\$container_name"',
    );
    expect(snapshotFunctionBlock).toContain(
      'if [ -z "\\$current_image" ]; then',
    );
    expect(snapshotBlockIndex).toBeGreaterThanOrEqual(0);
  });

  it("forces rollout restart when previous image snapshot is empty", () => {
    const jenkinsfile = readJenkinsfile();
    const deployStageIndex = jenkinsfile.indexOf("stage('Deploy to K8s')");
    const rolloutWorkloadIndex = jenkinsfile.indexOf(
      "rollout_workload() {",
      deployStageIndex,
    );

    expect(deployStageIndex).toBeGreaterThanOrEqual(0);
    expect(rolloutWorkloadIndex).toBeGreaterThan(deployStageIndex);
    expect(jenkinsfile).toContain('local previous_image="\\$2"');
    expect(jenkinsfile).toContain('local target_image="\\$3"');
    expect(jenkinsfile).toContain(
      'if [ -z "\\$previous_image" ] || [ "\\$previous_image" = "\\$target_image" ]; then',
    );
    expect(jenkinsfile).toContain(
      'kubectl rollout restart deployment/"\\$deployment_name" --namespace=${NAMESPACE}',
    );
    expect(jenkinsfile).toContain(
      'kubectl rollout status deployment/"\\$deployment_name" --namespace=${NAMESPACE} --timeout=600s',
    );
  });

  it("escapes jsonpath newlines safely when reading deployment image snapshots", () => {
    const jenkinsfile = readJenkinsfile();
    const deployStageIndex = jenkinsfile.indexOf("stage('Deploy to K8s')");
    const deployBlock = jenkinsfile.slice(deployStageIndex);
    const snapshotFunctionStart = deployBlock.indexOf("get_current_image() {");
    const snapshotFunctionEnd = deployBlock.indexOf("validate_image_ref() {");
    const snapshotFunctionBlock = deployBlock.slice(
      snapshotFunctionStart,
      snapshotFunctionEnd,
    );

    expect(deployStageIndex).toBeGreaterThanOrEqual(0);
    expect(snapshotFunctionStart).toBeGreaterThanOrEqual(0);
    expect(snapshotFunctionEnd).toBeGreaterThan(snapshotFunctionStart);
    expect(snapshotFunctionBlock).toContain(
      'kubectl get deployment "\\$deployment_name" -n ${NAMESPACE} -o jsonpath=\'{range .spec.template.spec.containers[*]}{.name}={.image}{"\\\\n"}{end}\'',
    );
    expect(snapshotFunctionBlock).not.toContain(
      'kubectl get deployment "\\$deployment_name" -n ${NAMESPACE} -o jsonpath=\'{range .spec.template.spec.containers[*]}{.name}={.image}{"\\n"}{end}\'',
    );
  });

  it("keeps the snapshot container contract on app, cron, and radius", () => {
    const jenkinsfile = readJenkinsfile();

    expect(jenkinsfile).toContain(
      'APP_PREVIOUS_IMAGE="\\$(get_current_image netmanager-app app)"',
    );
    expect(jenkinsfile).toContain(
      'CRON_PREVIOUS_IMAGE="\\$(get_current_image netmanager-cron cron)"',
    );
    expect(jenkinsfile).toContain(
      'RADIUS_PREVIOUS_IMAGE="\\$(get_current_image netmanager-radius radius)"',
    );
    expect(jenkinsfile).not.toContain(
      "get_current_image netmanager-app app-container",
    );
    expect(jenkinsfile).not.toContain(
      "get_current_image netmanager-cron cron-container",
    );
    expect(jenkinsfile).not.toContain(
      "get_current_image netmanager-radius radius-container",
    );
  });

  it("disables optional backfill for all environments (manual-only)", () => {
    const jenkinsfile = readJenkinsfile();
    const migrationYaml = readFileSync(
      resolve(process.cwd(), "k8s/migration-job.yaml"),
      "utf-8",
    );

    expect(jenkinsfile).toContain(
      'echo "Migration optional backfill policy: DISABLED (manual-only)"',
    );
    expect(jenkinsfile).not.toContain("{{SKIP_OPTIONAL_BACKFILL}}");
    expect(migrationYaml).toContain('value: "true"');
    expect(migrationYaml).not.toContain("{{SKIP_OPTIONAL_BACKFILL}}");
  });

  it("blocks production rollout when the active deployment image drifts from the Jenkins annotation contract", () => {
    const jenkinsfile = readJenkinsfile();

    expect(jenkinsfile).toContain("assert_cluster_image_contract() {");
    expect(jenkinsfile).toContain(
      'local expected_annotation="deploy.radpro.id/image-ref"',
    );
    expect(jenkinsfile).toContain(
      'current_annotation="\\$(kubectl get deployment "\\$deployment_name" -n ${NAMESPACE} -o jsonpath="{.spec.template.metadata.annotations.deploy\\\\.radpro\\\\.id/image-ref}")"',
    );
    expect(jenkinsfile).toContain('if [ -z "\\$current_annotation" ]; then');
    expect(jenkinsfile).toContain(
      'echo "⚠️ deployment/\\$deployment_name belum punya annotation \\$expected_annotation; izinkan rollout untuk bootstrap contract" >&2',
    );
    expect(jenkinsfile).toContain("return 0");
    expect(jenkinsfile).toContain(
      'if [ "\\$current_annotation" != "\\$current_image" ]; then',
    );
    expect(jenkinsfile).toContain(
      'echo "❌ Drift terdeteksi pada deployment/\\$deployment_name: image aktif \\$current_image tidak cocok dengan annotation \\$current_annotation" >&2',
    );
    expect(jenkinsfile).toContain(
      'if [ "${NAMESPACE}" = "netmanager-production" ]; then',
    );
    expect(jenkinsfile).toContain(
      "assert_cluster_image_contract netmanager-app app",
    );
    expect(jenkinsfile).toContain(
      "assert_cluster_image_contract netmanager-cron cron",
    );
    expect(jenkinsfile).toContain(
      "assert_cluster_image_contract netmanager-radius radius",
    );
  });

  it("bootstraps the deployment image annotation contract from rendered production manifests", () => {
    const appManifest = readFileSync(
      resolve(process.cwd(), "k8s", "production", "app-deployment.yaml"),
      "utf8",
    );
    const cronManifest = readFileSync(
      resolve(process.cwd(), "k8s", "production", "cron-deployment.yaml"),
      "utf8",
    );
    const radiusManifest = readFileSync(
      resolve(process.cwd(), "k8s", "production", "radius-deployment.yaml"),
      "utf8",
    );

    expect(appManifest).toContain(
      'deploy.radpro.id/image-ref: "{{APP_IMAGE}}"',
    );
    expect(cronManifest).toContain(
      'deploy.radpro.id/image-ref: "{{CRON_IMAGE}}"',
    );
    expect(radiusManifest).toContain(
      'deploy.radpro.id/image-ref: "{{RADIUS_IMAGE}}"',
    );
  });

  it("blocks production deploy before applying manifests when any node reports Ready=False or DiskPressure=True", () => {
    const jenkinsfile = readJenkinsfile();
    const deployStageIndex = jenkinsfile.indexOf("stage('Deploy to K8s')");
    const deployBlock = jenkinsfile.slice(deployStageIndex);
    const preflightIndex = deployBlock.indexOf(
      "require_cluster_nodes_ready_for_production_change before-production-rollout",
    );
    const applyIndex = deployBlock.indexOf(
      "kubectl apply -f ${K8S_DIR}/namespace.yaml",
    );

    expect(deployStageIndex).toBeGreaterThanOrEqual(0);
    expect(preflightIndex).toBeGreaterThanOrEqual(0);
    expect(applyIndex).toBeGreaterThan(preflightIndex);
    expect(deployBlock).toContain(
      "require_cluster_nodes_ready_for_production_change before-production-rollout",
    );
    expect(deployBlock).toContain(
      "require_cluster_nodes_ready_for_production_change() {",
    );
    expect(deployBlock).toContain(
      'echo "✅ Cluster node preflight aman untuk \\$change_label"',
    );
  });

  it("checks rendered deployment manifests with literal placeholder matching", () => {
    const jenkinsfile = readJenkinsfile();
    const deployStageIndex = jenkinsfile.indexOf("stage('Deploy to K8s')");
    const deployBlock = jenkinsfile.slice(deployStageIndex);
    const renderFunctionStart = deployBlock.indexOf(
      "render_manifest_to_file() {",
    );
    const renderFunctionEnd = deployBlock.indexOf(
      "assert_cluster_image_contract() {",
    );
    const renderFunctionBlock = deployBlock.slice(
      renderFunctionStart,
      renderFunctionEnd,
    );

    expect(deployStageIndex).toBeGreaterThanOrEqual(0);
    expect(renderFunctionStart).toBeGreaterThanOrEqual(0);
    expect(renderFunctionEnd).toBeGreaterThan(renderFunctionStart);
    expect(renderFunctionBlock).toContain(
      'grep -Fq -e "{{APP_IMAGE}}" -e "{{CRON_IMAGE}}" -e "{{RADIUS_IMAGE}}" "\\$rendered_manifest"',
    );
    expect(renderFunctionBlock).not.toContain(
      "grep -Eq '{{APP_IMAGE}}|{{CRON_IMAGE}}|{{RADIUS_IMAGE}}'",
    );
  });

  it("fails deploy when live netmanager-secrets still uses placeholder CRON_SECRET", () => {
    const jenkinsfile = readJenkinsfile();
    const deployStageIndex = jenkinsfile.indexOf("stage('Deploy to K8s')");
    const deployBlock = jenkinsfile.slice(deployStageIndex);
    const guardCallIndex = deployBlock.indexOf(
      "assert_live_secret_not_placeholder netmanager-secrets CRON_SECRET",
    );
    const applyIndex = deployBlock.indexOf(
      "kubectl apply -f ${K8S_DIR}/namespace.yaml",
    );
    const rolloutIndex = deployBlock.indexOf("rollout_workload netmanager-app");

    expect(deployStageIndex).toBeGreaterThanOrEqual(0);
    expect(deployBlock).toContain("decode_base64_secret_value() {");
    expect(deployBlock).toContain(
      "if printf '' | base64 --decode >/dev/null 2>&1; then",
    );
    expect(deployBlock).toContain("base64 --decode");
    expect(deployBlock).toContain("base64 -d");
    expect(deployBlock).toContain("assert_live_secret_not_placeholder() {");
    expect(deployBlock).toContain('local secret_name="\\$1"');
    expect(deployBlock).toContain('local secret_key="\\$2"');
    expect(deployBlock).toContain("local encoded_value");
    expect(deployBlock).toContain("local current_value");
    expect(deployBlock).toContain(
      'if ! encoded_value="\\$(kubectl get secret "\\$secret_name" -n ${NAMESPACE} -o jsonpath="{.data.\\${secret_key}}")"; then',
    );
    expect(deployBlock).not.toContain('jsonpath="{.data.${secret_key}}"');
    expect(deployBlock).toContain('jsonpath="{.data.\\${secret_key}}"');
    expect(deployBlock).toContain(
      "current_value=\"\\$(printf '%s' \"\\$encoded_value\" | decode_base64_secret_value | tr -d '\\r\\n')\"",
    );
    expect(deployBlock).toContain('if [ -z "\\$current_value" ]; then');
    expect(deployBlock).toContain(
      'echo "❌ Secret live \\$secret_name key \\$secret_key kosong atau tidak ada; bootstrap secret real dulu sebelum deploy" >&2',
    );
    expect(deployBlock).toContain(
      'if [ "\\$current_value" = "REPLACE_WITH_REAL_SECRET_BEFORE_DEPLOY" ]; then',
    );
    expect(deployBlock).toContain(
      'echo "❌ Secret live \\$secret_name key \\$secret_key masih placeholder; bootstrap secret real dulu sebelum deploy" >&2',
    );
    expect(guardCallIndex).toBeGreaterThanOrEqual(0);
    expect(applyIndex).toBeGreaterThan(guardCallIndex);
    expect(rolloutIndex).toBeGreaterThan(guardCallIndex);
  });

  it("creates FIREBASE_DATABASE_URL secret literals without wrapping the URL in quotes", () => {
    const jenkinsfile = readJenkinsfile();

    expect(jenkinsfile).toContain(
      'printf -- "--from-literal=FIREBASE_DATABASE_URL=%s" "${env.FIREBASE_DATABASE_URL}"',
    );
    expect(jenkinsfile).not.toContain(
      'printf -- "--from-literal=FIREBASE_DATABASE_URL=\'%s\'" "${env.FIREBASE_DATABASE_URL}"',
    );
  });
});
