import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Jaminan-jaminan di berkas ini menyangkut isi manifes produksi dan panduan
 * deploy, bukan pipeline yang menerapkannya. Semuanya dulu hidup di
 * `tests/ci/jenkinsfile-build-safety.test.ts` dan dipindah ke sini ketika
 * `Jenkinsfile` dihapus, supaya tidak ikut terbuang bersama berkas yang tidak
 * pernah menjadi subjeknya.
 */

type ImagePullSecretRef = {
  name: string;
};

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

describe("production manifest safety", () => {
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

  it("keeps production deployment manifests annotated with the rendered official image ref", () => {
    const appManifest = readManifest("k8s/production/app-deployment.yaml");
    const cronManifest = readManifest("k8s/production/cron-deployment.yaml");
    const radiusManifest = readManifest(
      "k8s/production/radius-deployment.yaml",
    );

    expect(appManifest).toContain('deploy.radpro.id/managed-by: "gitea"');
    expect(appManifest).toContain(
      'deploy.radpro.id/image-ref: "{{APP_IMAGE}}"',
    );

    expect(cronManifest).toContain('deploy.radpro.id/managed-by: "gitea"');
    expect(cronManifest).toContain(
      'deploy.radpro.id/image-ref: "{{CRON_IMAGE}}"',
    );

    expect(radiusManifest).toContain('deploy.radpro.id/managed-by: "gitea"');
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
});
