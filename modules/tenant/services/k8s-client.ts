/**
 * Akses API Kubernetes dari dalam cluster.
 *
 * Dipakai bersama oleh pengelola sertifikat dan pengelola route: keduanya
 * memuat konfigurasi yang sama, dan sebelumnya bootstrap ini disalin di setiap
 * metode.
 */
export async function loadCustomObjectsApi() {
  const { KubeConfig, CustomObjectsApi } =
    await import("@kubernetes/client-node");
  const kubeConfig = new KubeConfig();
  kubeConfig.loadFromCluster();

  return kubeConfig.makeApiClient(CustomObjectsApi);
}

/** Namespace tempat seluruh sumber daya tenant dibuat. */
export function getTenantNamespace(): string {
  return process.env.K8S_NAMESPACE || "netmanager-production";
}

/** Nama sumber daya Kubernetes milik satu tenant. */
export function buildTenantResourceName(slug: string): string {
  return `tenant-${slug}`;
}

/** Nama Secret TLS milik satu tenant. */
export function buildTenantTlsSecretName(slug: string): string {
  return `tenant-${slug}-tls`;
}
