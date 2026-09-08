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

function readPackageJson(): { scripts: Record<string, string> } {
  return JSON.parse(readManifest("package.json")) as {
    scripts: Record<string, string>;
  };
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

function getDockerfileBlockAfter(dockerfile: string, marker: string): string {
  const markerIndex = dockerfile.indexOf(marker);

  if (markerIndex === -1) {
    return "";
  }

  return dockerfile.slice(markerIndex + marker.length);
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
    expect(jenkinsfile).not.toContain('REGISTRY_URL = ""');
    expect(jenkinsfile).not.toContain('REGISTRY_NAMESPACE = ""');
    expect(jenkinsfile).not.toContain('REGISTRY_CREDENTIALS_ID = ""');
    expect(jenkinsfile).not.toContain('withEnv(["REGISTRY_URL_LEGACY=');
    expect(jenkinsfile).toContain(
      "def getRuntimeConfig = { String preferredName, String legacyName ->",
    );
    expect(jenkinsfile).toContain("params[preferredName] ?: ''");
    expect(jenkinsfile).toContain("params[legacyName] ?: ''");
    expect(jenkinsfile).toContain(
      "return preferredEnvValue ?: legacyEnvValue ?: preferredParamValue ?: legacyParamValue",
    );
    expect(jenkinsfile).toContain(
      "env.REGISTRY_URL = normalizeRegistryUrl(getRuntimeConfig('NETMANAGER_REGISTRY_URL', 'REGISTRY_URL'))",
    );
    expect(jenkinsfile).toContain(
      "env.REGISTRY_NAMESPACE = getRuntimeConfig('NETMANAGER_REGISTRY_NAMESPACE', 'REGISTRY_NAMESPACE')",
    );
    expect(jenkinsfile).toContain(
      "env.REGISTRY_CREDENTIALS_ID = getRuntimeConfig('NETMANAGER_REGISTRY_CREDENTIALS_ID', 'REGISTRY_CREDENTIALS_ID')",
    );
    expect(jenkinsfile).not.toContain("System.getenv(");
    expect(jenkinsfile).not.toContain("RUNTIME_REGISTRY_URL");
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
    expect(jenkinsfile).not.toContain("Push Images to Registry");
    expect(jenkinsfile).toContain("docker login");
    expect(jenkinsfile).toContain("docker buildx build --push");
    expect(jenkinsfile).toContain("verify_manifest()");
    expect(jenkinsfile).toContain('docker manifest inspect "\\$ref"');
    expect(jenkinsfile).toContain('verify_manifest "${env.APP_IMAGE_REF}"');
    expect(jenkinsfile).toContain('verify_manifest "${env.CRON_IMAGE_REF}"');
    expect(jenkinsfile).toContain('verify_manifest "${env.RADIUS_IMAGE_REF}"');
    expect(jenkinsfile).not.toContain(
      "chroot /host /usr/local/bin/k3s ctr images import -",
    );
    expect(jenkinsfile).not.toContain("docker run --rm -i --privileged");
  });

  it("does not fail backup image stage when source image is missing in registry", () => {
    const jenkinsfile = readJenkinsfile();

    expect(jenkinsfile).toContain('docker manifest inspect "\\$source_ref"');
    expect(jenkinsfile).toContain(
      'docker buildx imagetools create --tag "\\$backup_ref" "\\$source_ref"',
    );
    expect(jenkinsfile).toContain(
      'echo "No existing manifest at \\$source_ref; backup skipped" >&2',
    );
    expect(jenkinsfile).toContain("return 0");
    expect(jenkinsfile).not.toContain(
      'timeout 120 docker pull "\\$source_ref"',
    );
    expect(jenkinsfile).not.toContain(
      'timeout 120 docker push "\\$backup_ref"',
    );
  });

  it("binds runtime image refs through env to avoid Groovy missing property errors", () => {
    const jenkinsfile = readJenkinsfile();
    const envScopedImageRefs = [
      'env.APP_IMAGE_REF = "${env.REGISTRY_PATH}/${env.DOCKER_IMAGE}:${env.IMAGE_VERSION}"',
      'env.CRON_IMAGE_REF = "${env.REGISTRY_PATH}/${env.CRON_IMAGE}:${env.IMAGE_VERSION}"',
      'env.RADIUS_IMAGE_REF = "${env.REGISTRY_PATH}/${env.RADIUS_IMAGE}:${env.IMAGE_VERSION}"',
      'env.APP_IMAGE_ENV_REF = "${env.REGISTRY_PATH}/${env.DOCKER_IMAGE}:${env.DOCKER_TAG}"',
      'env.CRON_IMAGE_ENV_REF = "${env.REGISTRY_PATH}/${env.CRON_IMAGE}:${env.DOCKER_TAG}"',
      'env.RADIUS_IMAGE_ENV_REF = "${env.REGISTRY_PATH}/${env.RADIUS_IMAGE}:${env.DOCKER_TAG}"',
      'env.APP_IMAGE_PREV_REF = "${env.REGISTRY_PATH}/${env.DOCKER_IMAGE}:${env.DOCKER_TAG}-prev"',
      'env.CRON_IMAGE_PREV_REF = "${env.REGISTRY_PATH}/${env.CRON_IMAGE}:${env.DOCKER_TAG}-prev"',
      'env.RADIUS_IMAGE_PREV_REF = "${env.REGISTRY_PATH}/${env.RADIUS_IMAGE}:${env.DOCKER_TAG}-prev"',
      'backup_image "${env.APP_IMAGE_ENV_REF}" "${env.APP_IMAGE_PREV_REF}"',
      'backup_image "${env.CRON_IMAGE_ENV_REF}" "${env.CRON_IMAGE_PREV_REF}"',
      'backup_image "${env.RADIUS_IMAGE_ENV_REF}" "${env.RADIUS_IMAGE_PREV_REF}"',
      "docker buildx build --push --progress=plain \\\n                                -t ${env.APP_IMAGE_REF} -t ${env.APP_IMAGE_ENV_REF}",
      "docker buildx build --push --progress=plain \\\n                                -t ${env.CRON_IMAGE_REF} -t ${env.CRON_IMAGE_ENV_REF}",
      "docker buildx build --push --progress=plain \\\n                                -t ${env.RADIUS_IMAGE_REF} -t ${env.RADIUS_IMAGE_ENV_REF}",
      '--cache-from "type=registry,ref=${env.BUILDKIT_CACHE_REF_APP}"',
      '--cache-to   "type=registry,ref=${env.BUILDKIT_CACHE_REF_APP},mode=max"',
      '--cache-from "type=registry,ref=${env.BUILDKIT_CACHE_REF_CRON}"',
      '--cache-from "type=registry,ref=${env.BUILDKIT_CACHE_REF_RADIUS}"',
      'verify_manifest "${env.APP_IMAGE_REF}"',
      'verify_manifest "${env.APP_IMAGE_ENV_REF}"',
      'verify_manifest "${env.CRON_IMAGE_REF}"',
      'verify_manifest "${env.CRON_IMAGE_ENV_REF}"',
      'verify_manifest "${env.RADIUS_IMAGE_REF}"',
      'verify_manifest "${env.RADIUS_IMAGE_ENV_REF}"',
      "-e 's|{{IMAGE_TAG}}|${env.APP_IMAGE_REF}|g'",
      "-e 's|{{APP_IMAGE}}|${env.APP_DEPLOY_REF}|g'",
      "-e 's|{{CRON_IMAGE}}|${env.CRON_DEPLOY_REF}|g'",
      "-e 's|{{RADIUS_IMAGE}}|${env.RADIUS_DEPLOY_REF}|g'",
      "env.APP_DEPLOY_REF = resolveDeployImageRef('netmanager-app', env.APP_IMAGE_REF, params.RECOVERY_APP_IMAGE)",
      "env.CRON_DEPLOY_REF = resolveDeployImageRef('netmanager-cron', env.CRON_IMAGE_REF, params.RECOVERY_CRON_IMAGE)",
      "env.RADIUS_DEPLOY_REF = resolveDeployImageRef('netmanager-radius', env.RADIUS_IMAGE_REF, params.RECOVERY_RADIUS_IMAGE)",
      'rollout_workload netmanager-app "\\$APP_PREVIOUS_IMAGE" "${env.APP_DEPLOY_REF}"',
      'rollout_workload netmanager-cron "\\$CRON_PREVIOUS_IMAGE" "${env.CRON_DEPLOY_REF}"',
      'rollout_workload netmanager-radius "\\$RADIUS_PREVIOUS_IMAGE" "${env.RADIUS_DEPLOY_REF}"',
    ];
    const bareImageRefs = [
      'backup_image "${APP_IMAGE_ENV_REF}" "${APP_IMAGE_PREV_REF}"',
      'backup_image "${CRON_IMAGE_ENV_REF}" "${CRON_IMAGE_PREV_REF}"',
      'backup_image "${RADIUS_IMAGE_ENV_REF}" "${RADIUS_IMAGE_PREV_REF}"',
      "docker buildx build --load --progress=plain \\\n                                -t ${APP_IMAGE_REF} -t ${APP_IMAGE_ENV_REF}",
      "docker buildx build --load --progress=plain \\\n                                -t ${CRON_IMAGE_REF} -t ${CRON_IMAGE_ENV_REF} ./cron",
      "docker buildx build --load --progress=plain \\\n                                -t ${RADIUS_IMAGE_REF} -t ${RADIUS_IMAGE_ENV_REF} -f radius/Dockerfile .",
      'push_and_verify "${APP_IMAGE_REF}"',
      'push_and_verify "${APP_IMAGE_ENV_REF}"',
      'push_and_verify "${CRON_IMAGE_REF}"',
      'push_and_verify "${CRON_IMAGE_ENV_REF}"',
      'push_and_verify "${RADIUS_IMAGE_REF}"',
      'push_and_verify "${RADIUS_IMAGE_ENV_REF}"',
      "-e 's|{{IMAGE_TAG}}|${APP_IMAGE_REF}|g'",
      "-e 's|{{APP_IMAGE}}|${APP_IMAGE_REF}|g'",
      "-e 's|{{CRON_IMAGE}}|${CRON_IMAGE_REF}|g'",
      "-e 's|{{RADIUS_IMAGE}}|${RADIUS_IMAGE_REF}|g'",
      'rollout_workload netmanager-app "\\$APP_PREVIOUS_IMAGE" "${APP_IMAGE_REF}"',
      'rollout_workload netmanager-cron "\\$CRON_PREVIOUS_IMAGE" "${CRON_IMAGE_REF}"',
      'rollout_workload netmanager-radius "\\$RADIUS_PREVIOUS_IMAGE" "${RADIUS_IMAGE_REF}"',
    ];

    for (const imageRef of envScopedImageRefs) {
      expect(jenkinsfile).toContain(imageRef);
    }

    for (const imageRef of bareImageRefs) {
      expect(jenkinsfile).not.toContain(imageRef);
    }
  });

  it("does not predeclare runtime image refs as empty environment placeholders", () => {
    const jenkinsfile = readJenkinsfile();
    const runtimeImageRefPlaceholders = [
      'APP_IMAGE_REF = ""',
      'CRON_IMAGE_REF = ""',
      'RADIUS_IMAGE_REF = ""',
      'APP_IMAGE_ENV_REF = ""',
      'CRON_IMAGE_ENV_REF = ""',
      'RADIUS_IMAGE_ENV_REF = ""',
      'APP_IMAGE_PREV_REF = ""',
      'CRON_IMAGE_PREV_REF = ""',
      'RADIUS_IMAGE_PREV_REF = ""',
      'APP_DEPLOY_REF = ""',
      'CRON_DEPLOY_REF = ""',
      'RADIUS_DEPLOY_REF = ""',
    ];

    for (const placeholder of runtimeImageRefPlaceholders) {
      expect(jenkinsfile).not.toContain(placeholder);
    }
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
      'kubectl get secret "\\$REGISTRY_SECRET" --namespace=${NAMESPACE} >/dev/null',
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
    const migrationJobRenderIndex = jenkinsfile.indexOf(
      "-e 's|{{REGISTRY_SECRET}}|${NAMESPACE}-registry|g'",
      migrationStageIndex,
    );
    const migrationJobLiteralSecretRenderIndex = jenkinsfile.indexOf(
      "-e 's|{{REGISTRY_SECRET}}|\\$REGISTRY_SECRET|g'",
      migrationStageIndex,
    );
    const deploySecretCheckIndex = jenkinsfile.indexOf(
      'kubectl get secret "\\$REGISTRY_SECRET" --namespace=${NAMESPACE} >/dev/null',
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
    expect(jenkinsfile).toContain("Registry pull auth secret");
    expect(jenkinsfile).toContain("tidak ditemukan di namespace ${NAMESPACE}.");
    expect(jenkinsfile).toContain(
      "Pipeline sengaja tidak meng-apply template placeholder ${K8S_DIR}/registry-secret.yaml.",
    );
    expect(jenkinsfile).toContain(
      "Bootstrap secret live di cluster terlebih dahulu sebelum menjalankan ulang pipeline ini.",
    );
    expect(jenkinsfile).toContain("kubectl create secret docker-registry");
    expect(jenkinsfile).toContain("--docker-server=${REGISTRY_URL}");
    expect(jenkinsfile).not.toContain("${REGISTRY_SECRET}");
    expect(firstSecretCheckIndex).toBeGreaterThan(-1);
    expect(migrationBackupIndex).toBeGreaterThan(-1);
    expect(firstSecretCheckIndex).toBeLessThan(migrationBackupIndex);
    expect(migrationDeleteJobIndex).toBeGreaterThan(-1);
    expect(firstSecretCheckIndex).toBeLessThan(migrationDeleteJobIndex);
    expect(migrationJobRenderIndex).toBeGreaterThan(-1);
    expect(migrationJobLiteralSecretRenderIndex).toBe(-1);
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

  it("excludes transient build directories and keeps Prisma generate explicit in CI and Docker build paths", () => {
    const dockerignore = readManifest(".dockerignore");
    const packageJson = readPackageJson();
    const jenkinsfile = readJenkinsfile();
    const dockerfile = readDockerfile();
    const builderStage = getDockerfileStageBlock(dockerfile, "builder");
    const prodDepsStage = getDockerfileStageBlock(dockerfile, "prod-deps");
    const runnerStage = getDockerfileStageBlock(dockerfile, "runner");
    const prismaGenerateMatches =
      dockerfile.match(/RUN npm run prisma:generate/g) ?? [];
    const npmCiMatches =
      dockerfile.match(
        /npm ci --legacy-peer-deps --no-audit --prefer-offline --ignore-scripts/g,
      ) ?? [];
    const installIndex = jenkinsfile.indexOf(
      "npm ci --no-audit --prefer-offline --ignore-scripts",
    );
    // Sequential generate (bukan -parallel) — peak RAM lebih rendah di QC stage.
    const explicitGenerateIndex = jenkinsfile.indexOf(
      "npm run prisma:generate\n",
    );

    expect(dockerignore).toContain("tmp/");
    expect(dockerignore).toContain(".worktrees/");
    expect(dockerignore).toContain(".claude/");
    expect(packageJson.scripts.postinstall).toBe("npm run prisma:generate");
    expect(jenkinsfile).toContain("--ignore-scripts");
    expect(jenkinsfile).toContain("npm run prisma:generate");
    expect(jenkinsfile).not.toContain("npm run prisma:generate-parallel");
    expect(installIndex).toBeGreaterThan(-1);
    expect(explicitGenerateIndex).toBeGreaterThan(-1);
    expect(installIndex).toBeLessThan(explicitGenerateIndex);
    expect(jenkinsfile).not.toContain(
      "npm ci --no-audit --prefer-offline && npm run prisma:generate",
    );
    expect(builderStage).toContain("FROM node:24-alpine AS builder");
    expect(builderStage).toContain(
      "COPY --from=deps /app/node_modules ./node_modules",
    );
    expect(builderStage).toContain("COPY . .");
    // Dua generate yang disengaja: builder butuh client saat mengompilasi, dan
    // prod-deps menyiapkan client untuk node_modules yang dipakai runtime.
    // Dulu hanya ada satu karena runner memakai node_modules bekas builder yang
    // dipangkas `npm prune`; pemangkasan itu diganti pemasangan bersih karena
    // memakan 9,6 menit dari 31 menit build.
    expect(prismaGenerateMatches).toHaveLength(2);
    expect(npmCiMatches).toHaveLength(1);

    // Client Prisma harus ada di image runtime. Dulu dijamin dengan memastikan
    // generate terjadi sebelum prune; sekarang dijamin karena prod-deps
    // men-generate sendiri dan runner menyalin node_modules dari sana.
    expect(dockerfile).not.toContain("RUN npm prune");
    expect(prodDepsStage).toContain("npm ci --omit=dev");
    expect(prodDepsStage).toContain("RUN npm run prisma:generate");
    expect(runnerStage).toContain(
      "COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules",
    );
    expect(runnerStage).not.toContain(
      "COPY --from=builder --chown=nextjs:nodejs /app/node_modules",
    );
  });

  it("keeps production deployment manifests annotated with the rendered official image ref", () => {
    const appManifest = readManifest("k8s/production/app-deployment.yaml");
    const cronManifest = readManifest("k8s/production/cron-deployment.yaml");
    const radiusManifest = readManifest(
      "k8s/production/radius-deployment.yaml",
    );

    expect(appManifest).toContain('deploy.radpro.id/managed-by: "jenkins"');
    expect(appManifest).toContain(
      'deploy.radpro.id/image-ref: "{{APP_IMAGE}}"',
    );

    expect(cronManifest).toContain('deploy.radpro.id/managed-by: "jenkins"');
    expect(cronManifest).toContain(
      'deploy.radpro.id/image-ref: "{{CRON_IMAGE}}"',
    );

    expect(radiusManifest).toContain('deploy.radpro.id/managed-by: "jenkins"');
    expect(radiusManifest).toContain(
      'deploy.radpro.id/image-ref: "{{RADIUS_IMAGE}}"',
    );
  });

  it("renders deployment manifests with quoted image placeholders for pipeline substitution", () => {
    const manifests = [
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

  it("renders deployment manifests to files and rejects non-registry image refs", () => {
    const jenkinsfile = readJenkinsfile();

    expect(jenkinsfile).toContain("validate_image_ref() {");
    expect(jenkinsfile).toContain('case "\\$image_ref" in');
    expect(jenkinsfile).toContain('"${REGISTRY_PATH}/"* )');
    expect(jenkinsfile).toContain(
      'echo "❌ Image ref untuk \\$workload harus memakai registry resmi: \\$image_ref" >&2',
    );
    expect(jenkinsfile).toContain("render_manifest_to_file() {");
    expect(jenkinsfile).toContain(
      'grep -Fq -e "{{APP_IMAGE}}" -e "{{CRON_IMAGE}}" -e "{{RADIUS_IMAGE}}" "\\$rendered_manifest"',
    );
    expect(jenkinsfile).not.toContain(
      "grep -Eq '{{APP_IMAGE}}|{{CRON_IMAGE}}|{{RADIUS_IMAGE}}' \"\\$rendered_manifest\"",
    );
    expect(jenkinsfile).toContain('kubectl apply -f "\\$rendered_manifest"');
  });

  it("forces rollout restart when the deployment snapshot is empty or already matches the target image", () => {
    const jenkinsfile = readJenkinsfile();
    const deployStageIndex = jenkinsfile.indexOf("stage('Deploy to K8s')");
    const appImageSnapshotIndex = jenkinsfile.indexOf(
      'APP_PREVIOUS_IMAGE="\\$(get_current_image netmanager-app app)"',
      deployStageIndex,
    );
    const rolloutWorkloadIndex = jenkinsfile.indexOf(
      "rollout_workload() {",
      deployStageIndex,
    );

    expect(jenkinsfile).toContain("get_current_image() {");
    expect(deployStageIndex).toBeGreaterThan(-1);
    expect(appImageSnapshotIndex).toBeGreaterThan(-1);
    expect(rolloutWorkloadIndex).toBeGreaterThan(-1);
    expect(appImageSnapshotIndex).toBeLessThan(rolloutWorkloadIndex);
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
    expect(jenkinsfile).toContain(
      'rollout_workload netmanager-app "\\$APP_PREVIOUS_IMAGE" "${env.APP_DEPLOY_REF}"',
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
    const registrySecretManifests = ["k8s/production/registry-secret.yaml"];

    const workloadManifests = [
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
      expect(manifest).toMatch(/name:\s+netmanager-production-registry/);
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
        expect(imagePullSecrets[0].name).toBe("netmanager-production-registry");
      }
    }
  });

  it("pins Jenkins pod agent images to explicit non-floating versions", () => {
    const jenkinsfile = readJenkinsfile();

    expect(jenkinsfile).toContain(
      "image: jenkins/inbound-agent:3355.v388858a_47b_33-17-rhel-ubi9-jdk21",
    );
    expect(jenkinsfile).toContain("image: node:24.15.0-alpine3.23");
    expect(jenkinsfile).toContain("image: docker:29.4.0-cli-alpine3.23");
    expect(jenkinsfile).toContain("image: dtzar/helm-kubectl:4.1.3");
    expect(jenkinsfile).not.toContain("image: jenkins/inbound-agent:latest");
    expect(jenkinsfile).not.toContain("image: node:24-alpine");
    expect(jenkinsfile).not.toContain("image: docker:cli");
    expect(jenkinsfile).not.toContain("image: dtzar/helm-kubectl:latest");
  });

  it("passes git revision metadata explicitly to app image builds", () => {
    const jenkinsfile = readJenkinsfile();
    const dockerfile = readDockerfile();

    expect(jenkinsfile).toContain(
      'IMAGE_REVISION = "${env.GIT_COMMIT ?: "unknown"}"',
    );
    expect(jenkinsfile).toContain(
      '--build-arg IMAGE_REVISION="${env.IMAGE_REVISION}"',
    );
    expect(jenkinsfile).toContain(
      "--label org.opencontainers.image.revision=${env.IMAGE_REVISION}",
    );
    expect(jenkinsfile).toContain("BUILDX_GIT_INFO=0");

    expect(dockerfile).toContain('ARG IMAGE_REVISION="unknown"');
    expect(dockerfile).toContain(
      "LABEL org.opencontainers.image.revision=$IMAGE_REVISION",
    );
  });

  it("cleans up only pipeline-managed images instead of pruning the shared host Docker daemon", () => {
    const jenkinsfile = readJenkinsfile();

    expect(jenkinsfile).toContain(
      "Pruning Docker cache on shared daemon (images pushed directly to registry, no local load)...",
    );
    expect(jenkinsfile).not.toContain("docker builder prune");
    expect(jenkinsfile).toContain("docker image prune -f");
    expect(jenkinsfile).toContain("remove_local_image() {");
    expect(jenkinsfile).toContain('remove_local_image "${env.APP_IMAGE_REF}"');
    expect(jenkinsfile).toContain(
      'remove_local_image "${env.APP_IMAGE_ENV_REF}"',
    );
    expect(jenkinsfile).toContain(
      'remove_local_image "${env.APP_IMAGE_PREV_REF}"',
    );
    expect(jenkinsfile).toContain('remove_local_image "${env.CRON_IMAGE_REF}"');
    expect(jenkinsfile).toContain(
      'remove_local_image "${env.CRON_IMAGE_ENV_REF}"',
    );
    expect(jenkinsfile).toContain(
      'remove_local_image "${env.CRON_IMAGE_PREV_REF}"',
    );
    expect(jenkinsfile).toContain(
      'remove_local_image "${env.RADIUS_IMAGE_REF}"',
    );
    expect(jenkinsfile).toContain(
      'remove_local_image "${env.RADIUS_IMAGE_ENV_REF}"',
    );
    expect(jenkinsfile).toContain(
      'remove_local_image "${env.RADIUS_IMAGE_PREV_REF}"',
    );
    expect(jenkinsfile).not.toContain("docker system prune -f");
  });
});
