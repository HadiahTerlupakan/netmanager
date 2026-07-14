import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("fcm build config contract", () => {
  it("injects browser Firebase env and VAPID public key during the app image build", () => {
    const jenkinsfile = readProjectFile("Jenkinsfile");
    const dockerfile = readProjectFile("Dockerfile");

    expect(jenkinsfile).toContain("--build-arg NEXT_PUBLIC_FIREBASE_API_KEY");
    expect(jenkinsfile).toContain(
      "--build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    );
    expect(jenkinsfile).toContain(
      "--build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    );
    expect(jenkinsfile).toContain(
      "--build-arg NEXT_PUBLIC_FIREBASE_DATABASE_URL",
    );
    expect(jenkinsfile).toContain(
      "--build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    );
    expect(jenkinsfile).toContain(
      "--build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    );
    expect(jenkinsfile).toContain("--build-arg NEXT_PUBLIC_FIREBASE_APP_ID");
    expect(jenkinsfile).toContain("--build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY");

    expect(dockerfile).toContain("ARG NEXT_PUBLIC_FIREBASE_API_KEY");
    expect(dockerfile).toContain("ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
    expect(dockerfile).toContain("ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID");
    expect(dockerfile).toContain("ARG NEXT_PUBLIC_FIREBASE_DATABASE_URL");
    expect(dockerfile).toContain("ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
    expect(dockerfile).toContain(
      "ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    );
    expect(dockerfile).toContain("ARG NEXT_PUBLIC_FIREBASE_APP_ID");
    expect(dockerfile).toContain("ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  });

  it("keeps env templates and deploy helper aligned to FCM-only browser setup", () => {
    const envExample = readProjectFile(".env.production.example");
    const deployScript = readProjectFile("deploy.sh");
    const productionSecrets = readProjectFile("k8s/production/secrets.yaml");

    expect(envExample).toContain("NEXT_PUBLIC_FIREBASE_API_KEY=");
    expect(envExample).toContain("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=");
    expect(envExample).toContain("NEXT_PUBLIC_FIREBASE_PROJECT_ID=");
    expect(envExample).toContain("NEXT_PUBLIC_FIREBASE_DATABASE_URL=");
    expect(envExample).toContain("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=");
    expect(envExample).toContain("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=");
    expect(envExample).toContain("NEXT_PUBLIC_FIREBASE_APP_ID=");
    expect(envExample).toContain("NEXT_PUBLIC_VAPID_PUBLIC_KEY=");
    expect(envExample).toContain("FIREBASE_PROJECT_ID=");
    expect(envExample).toContain("FIREBASE_CLIENT_EMAIL=");
    expect(envExample).toContain("FIREBASE_PRIVATE_KEY=");
    expect(envExample).toContain("FIREBASE_DATABASE_URL=");
    expect(envExample).not.toContain("VAPID_PRIVATE_KEY=");
    expect(envExample).not.toContain("VAPID_SUBJECT=");

    expect(deployScript).toContain("NEXT_PUBLIC_FIREBASE_API_KEY");
    expect(deployScript).toContain("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
    expect(deployScript).toContain("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
    expect(deployScript).toContain("NEXT_PUBLIC_FIREBASE_DATABASE_URL");
    expect(deployScript).toContain("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
    expect(deployScript).toContain("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
    expect(deployScript).toContain("NEXT_PUBLIC_FIREBASE_APP_ID");
    expect(deployScript).toContain("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
    expect(deployScript).not.toContain("VAPID_PRIVATE_KEY");
    expect(deployScript).not.toContain("VAPID_SUBJECT");

    expect(productionSecrets).not.toContain("VAPID_PRIVATE_KEY");
    expect(productionSecrets).not.toContain("VAPID_SUBJECT");
  });
});
