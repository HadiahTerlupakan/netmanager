import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type ImagePullSecretRef = {
  name: string;
};

function readJenkinsfile(): string {
  return readFileSync(resolve(process.cwd(), "Jenkinsfile"), "utf8");
}

function readDockerfile(): string {
  return readFileSync(resolve(process.cwd(), "Dockerfile"), "utf8");
}

function readManifest(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function extractDockerConfigJson(relativePath: string): string {
  const manifest = readManifest(relativePath);
  const match = manifest.match(/\.dockerconfigjson:\s*'([^']+)'/);

  if (!match) {
    throw new Error(`Missing .dockerconfigjson in ${relativePath}`);
  }

  return match[1];
}

function extractImagePullSecrets(relativePath: string): ImagePullSecretRef[] {
  const manifest = readManifest(relativePath);
  const imagePullSecretsSection = manifest.match(
    /imagePullSecrets:\n((?:\s+- name:.*\n)+)/,
  );

  if (!imagePullSecretsSection) {
    throw new Error(`Missing imagePullSecrets in ${relativePath}`);
  }

  return imagePullSecretsSection[1]
    .trim()
    .split("\n")
    .map((line) => line.match(/- name:\s+"?([^"\n]+)"?$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({ name: match[1] }));
}

function getDockerfileStageBlock(
  dockerfile: string,
  stageName: string,
): string {
  const stageStart = dockerfile.indexOf(`FROM node:24-alpine AS ${stageName}`);

  if (stageStart === -1) {
    return "";
  }

  const nextStageStart = dockerfile.indexOf(
    "FROM node:24-alpine AS ",
    stageStart + 1,
  );

  return nextStageStart === -1
    ? dockerfile.slice(stageStart)
    : dockerfile.slice(stageStart, nextStageStart);
}

describe("Jenkinsfile and Dockerfile build safety", () => {
  it("uses deterministic npm ci without npm install fallback in CI/build paths", () => {
    const jenkinsfile = readJenkinsfile();
    const dockerfile = readDockerfile();
    const depsStage = getDockerfileStageBlock(dockerfile, "deps");

    expect(jenkinsfile).toContain("npm ci --no-audit --prefer-offline");
    expect(jenkinsfile).not.toContain("|| npm install");

    expect(dockerfile).toContain("COPY package.json package-lock.json ./");
    expect(dockerfile).toContain(
      "COPY scripts/run-husky-prepare.js ./scripts/run-husky-prepare.js",
    );
    expect(depsStage).toContain("COPY prisma ./prisma");
    expect(depsStage).toContain("prisma.config.ts");
    expect(depsStage).toContain("prisma.radius.config.ts");
    expect(depsStage).toContain("prisma.billing.config.ts");
    expect(depsStage).toContain("prisma.mitra.config.ts");
    expect(dockerfile).toContain(
      "npm ci --legacy-peer-deps --no-audit --prefer-offline --ignore-scripts",
    );
    expect(dockerfile).not.toContain("|| npm install");
  });

  it("enforces registry validation and push-before-deploy flow", () => {
    const jenkinsfile = readJenkinsfile();

    expect(jenkinsfile).toContain("Validate Registry Configuration");
    expect(jenkinsfile).toContain('REGISTRY_URL = ""');
    expect(jenkinsfile).toContain('REGISTRY_NAMESPACE = ""');
    expect(jenkinsfile).toContain('REGISTRY_CREDENTIALS_ID = ""');
    expect(jenkinsfile).toContain(
      "def getRuntimeConfig = { String preferredName, String legacyName ->",
    );
    expect(jenkinsfile).toContain(
      "def preferredValue = (System.getenv(preferredName) ?: '').trim()",
    );
    expect(jenkinsfile).toContain(
      "def legacyValue = (System.getenv(legacyName) ?: '').trim()",
    );
    expect(jenkinsfile).toContain(
      "env.REGISTRY_URL = normalizeRegistryUrl(getRuntimeConfig('NETMANAGER_REGISTRY_URL', 'REGISTRY_URL'))",
    );
    expect(jenkinsfile).toContain(
      "env.REGISTRY_NAMESPACE = getRuntimeConfig('NETMANAGER_REGISTRY_NAMESPACE', 'REGISTRY_NAMESPACE').trim()",
    );
    expect(jenkinsfile).toContain(
      "env.REGISTRY_CREDENTIALS_ID = getRuntimeConfig('NETMANAGER_REGISTRY_CREDENTIALS_ID', 'REGISTRY_CREDENTIALS_ID').trim()",
    );
    expect(jenkinsfile).toContain(
      "NETMANAGER_REGISTRY_URL (atau REGISTRY_URL) wajib disediakan di runtime Jenkins.",
    );
    expect(jenkinsfile).toContain(
      "NETMANAGER_REGISTRY_NAMESPACE (atau REGISTRY_NAMESPACE) wajib disediakan di runtime Jenkins.",
    );
    expect(jenkinsfile).toContain(
      "NETMANAGER_REGISTRY_CREDENTIALS_ID (atau REGISTRY_CREDENTIALS_ID) wajib disediakan di runtime Jenkins.",
    );
    expect(jenkinsfile).toContain("Backup Previous Env Image");
    expect(jenkinsfile).toContain("Push Images to Registry");
    expect(jenkinsfile).toContain("docker login");
    expect(jenkinsfile).toContain('push_and_verify "${APP_IMAGE_REF}"');
    expect(jenkinsfile).toContain('push_and_verify "${CRON_IMAGE_REF}"');
    expect(jenkinsfile).toContain('push_and_verify "${RADIUS_IMAGE_REF}"');
    expect(jenkinsfile).not.toContain(
      "chroot /host /usr/local/bin/k3s ctr images import -",
    );
    expect(jenkinsfile).not.toContain("docker run --rm -i --privileged");
  });

  it("does not auto-apply placeholder registry secret templates during deploy", () => {
    const jenkinsfile = readJenkinsfile();

    expect(jenkinsfile).toContain('! -name "registry-secret.yaml"');
  });

  it("fails fast when namespace registry pull secret is missing before migration or deploy rollout", () => {
    const jenkinsfile = readJenkinsfile();
    const migrationStageIndex = jenkinsfile.indexOf(
      "stage('Database Migration (Zero Downtime K8s Job)')",
    );
    const deployStageIndex = jenkinsfile.indexOf("stage('Deploy to K8s')");
    const firstSecretCheckIndex = jenkinsfile.indexOf(
      'kubectl get secret "${REGISTRY_SECRET}" --namespace=${NAMESPACE} >/dev/null',
      migrationStageIndex,
    );
    const migrationBackupIndex = jenkinsfile.indexOf(
      "def backupStatus = sh(",
      migrationStageIndex,
    );
    const migrationDeleteJobIndex = jenkinsfile.indexOf(
      "kubectl delete job netmanager-migration-job",
      migrationStageIndex,
    );
    const deploySecretCheckIndex = jenkinsfile.indexOf(
      'kubectl get secret "${REGISTRY_SECRET}" --namespace=${NAMESPACE} >/dev/null',
      deployStageIndex,
    );
    const deployAppSnapshotIndex = jenkinsfile.indexOf(
      'APP_PREVIOUS_IMAGE="\\$(get_current_image netmanager-app app)"',
      deployStageIndex,
    );
    const deployApplyNamespaceIndex = jenkinsfile.indexOf(
      "kubectl apply -f ${K8S_DIR}/namespace.yaml",
      deployStageIndex,
    );

    expect(jenkinsfile).toContain(
      'echo "Verifying registry pull auth secret in ${NAMESPACE}..."',
    );
    expect(jenkinsfile).toContain('REGISTRY_SECRET="${NAMESPACE}-registry"');
    expect(firstSecretCheckIndex).toBeGreaterThan(-1);
    expect(migrationBackupIndex).toBeGreaterThan(-1);
    expect(firstSecretCheckIndex).toBeLessThan(migrationBackupIndex);
    expect(migrationDeleteJobIndex).toBeGreaterThan(-1);
    expect(firstSecretCheckIndex).toBeLessThan(migrationDeleteJobIndex);
    expect(deploySecretCheckIndex).toBeGreaterThan(-1);
    expect(deployAppSnapshotIndex).toBeGreaterThan(-1);
    expect(deploySecretCheckIndex).toBeLessThan(deployAppSnapshotIndex);
    expect(deployApplyNamespaceIndex).toBeGreaterThan(-1);
    expect(deploySecretCheckIndex).toBeLessThan(deployApplyNamespaceIndex);
  });

  it("documents deploy flow as rendered manifest apply instead of kubectl set image", () => {
    const deploymentGuide = readManifest("DEPLOYMENT.md");

    expect(deploymentGuide).not.toContain("kubectl set image");
    expect(deploymentGuide).toContain(
      "- render manifest Kubernetes dengan image ref immutable",
    );
    expect(deploymentGuide).toContain(
      "4. Deployment merender manifest lalu apply ke Kubernetes",
    );
  });

  it("copies Prisma schema inputs and runs prisma generate after the app source copy in the builder stage", () => {
    const dockerfile = readDockerfile();
    const builderStage = getDockerfileStageBlock(dockerfile, "builder");
    const appCopyIndex = builderStage.indexOf("COPY . .");
    const prismaGenerateIndex = builderStage.indexOf(
      "RUN npm run prisma:generate",
    );

    expect(builderStage).toContain("FROM node:24-alpine AS builder");
    expect(builderStage).toContain(
      "COPY --from=deps /app/node_modules ./node_modules",
    );

    expect(appCopyIndex).toBeGreaterThan(-1);
    expect(prismaGenerateIndex).toBeGreaterThan(-1);
    expect(appCopyIndex).toBeLessThan(prismaGenerateIndex);
  });

  it("renders deployment manifests with quoted image placeholders for pipeline substitution", () => {
    const manifests = [
      "k8s/staging/app-deployment.yaml",
      "k8s/staging/cron-deployment.yaml",
      "k8s/staging/radius-deployment.yaml",
      "k8s/production/app-deployment.yaml",
      "k8s/production/cron-deployment.yaml",
      "k8s/production/radius-deployment.yaml",
    ];

    for (const manifestPath of manifests) {
      const manifest = readManifest(manifestPath);

      expect(manifest).not.toMatch(/image:\s+\{\{[A-Z_]+\}\}/);
      expect(manifest).toMatch(/image:\s+"\{\{[A-Z_]+\}\}"/);
    }
  });

  it("avoids rollout restart when manifest apply already changes the deployment image", () => {
    const jenkinsfile = readJenkinsfile();
    const deployStageIndex = jenkinsfile.indexOf("stage('Deploy to K8s')");
    const appImageSnapshotIndex = jenkinsfile.indexOf(
      'APP_PREVIOUS_IMAGE="\\$(get_current_image netmanager-app app)"',
      deployStageIndex,
    );
    const manifestLoopIndex = jenkinsfile.indexOf(
      'find ${K8S_DIR}/ -maxdepth 1 -name "*.yaml"',
      deployStageIndex,
    );

    expect(jenkinsfile).toContain("get_current_image() {");
    expect(deployStageIndex).toBeGreaterThan(-1);
    expect(appImageSnapshotIndex).toBeGreaterThan(-1);
    expect(manifestLoopIndex).toBeGreaterThan(-1);
    expect(appImageSnapshotIndex).toBeLessThan(manifestLoopIndex);
    expect(jenkinsfile).toContain('local previous_image="\\$2"');
    expect(jenkinsfile).toMatch(
      /if \[ -n "\\\$previous_image" \] && \[ "\\\$previous_image" = "\\\$target_image" \]; then/,
    );
    expect(jenkinsfile).toContain(
      'rollout_workload netmanager-app "\\$APP_PREVIOUS_IMAGE" "${APP_IMAGE_REF}"',
    );
    expect(jenkinsfile).not.toContain(
      'local current_image="\\$(get_current_image "\\$deployment_name" "\\$container_name")"',
    );
  });

  it("fails production migration by default when backup fails unless explicit override is set", () => {
    const jenkinsfile = readJenkinsfile();

    expect(jenkinsfile).toContain("ALLOW_MIGRATION_WITHOUT_BACKUP");
    expect(jenkinsfile).toContain(
      "Pre-migration backup failed; aborting production migration",
    );
  });

  it("declares registry pull auth secrets and wires them into all private-image workloads", () => {
    const registrySecretManifests = [
      "k8s/staging/registry-secret.yaml",
      "k8s/production/registry-secret.yaml",
    ];

    const workloadManifests = [
      "k8s/staging/app-deployment.yaml",
      "k8s/staging/cron-deployment.yaml",
      "k8s/staging/radius-deployment.yaml",
      "k8s/production/app-deployment.yaml",
      "k8s/production/cron-deployment.yaml",
      "k8s/production/radius-deployment.yaml",
      "k8s/migration-job.yaml",
    ];

    for (const manifestPath of registrySecretManifests) {
      const manifest = readManifest(manifestPath);
      const dockerConfigJson = JSON.parse(
        extractDockerConfigJson(manifestPath),
      );

      expect(manifest).toContain("type: kubernetes.io/dockerconfigjson");
      expect(manifest).toMatch(
        /name:\s+netmanager-(staging|production)-registry/,
      );
      expect(manifest).toContain(".dockerconfigjson");
      expect(dockerConfigJson).toEqual({
        auths: {
          REGISTRY_URL: {
            username: "REGISTRY_USERNAME",
            password: "REGISTRY_PASSWORD",
            auth: "REGISTRY_AUTH",
          },
        },
      });
    }

    for (const manifestPath of workloadManifests) {
      const manifest = readManifest(manifestPath);

      expect(manifest).toMatch(/imagePullSecrets:/);

      const imagePullSecrets = extractImagePullSecrets(manifestPath);

      if (manifestPath === "k8s/migration-job.yaml") {
        expect(imagePullSecrets).toEqual([{ name: "{{REGISTRY_SECRET}}" }]);
      } else {
        expect(imagePullSecrets).toHaveLength(1);
        expect(imagePullSecrets[0].name).toMatch(
          /^netmanager-(staging|production)-registry$/,
        );
      }
    }
  });
});
