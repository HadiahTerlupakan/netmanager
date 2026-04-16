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
      'rollout_workload netmanager-cron "\\$CRON_PREVIOUS_IMAGE" "${env.CRON_IMAGE_REF}"',
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
      'rollout_workload netmanager-radius "\\$RADIUS_PREVIOUS_IMAGE" "${env.RADIUS_IMAGE_REF}"',
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
    const snapshotFunctionEnd = deployBlock.indexOf("render_manifest() {");
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
      'if ! deployment_snapshot="\\$(kubectl get deployment "\\$deployment_name" -n ${NAMESPACE} -o jsonpath=\'{range .spec.template.spec.containers[*]}{.name}={.image}{"\\n"}{end}\')"; then',
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
});
