import { logger } from "@/lib/logger";

interface CertificateSpec {
  slug: string;
  domain: string;
  namespace: string;
}

export class K8sCertificateService {
  private namespace: string;

  constructor() {
    this.namespace = process.env.K8S_NAMESPACE || "netmanager-production";
  }

  /** Create a cert-manager Certificate resource for a tenant custom domain. */
  async createCertificate(spec: CertificateSpec): Promise<boolean> {
    try {
      const { KubeConfig, CustomObjectsApi } =
        await import("@kubernetes/client-node");
      const kc = new KubeConfig();
      kc.loadFromCluster();
      const customApi = kc.makeApiClient(CustomObjectsApi);

      const certResource = {
        apiVersion: "cert-manager.io/v1",
        kind: "Certificate",
        metadata: {
          name: `tenant-${spec.slug}-tls`,
          namespace: spec.namespace,
        },
        spec: {
          secretName: `tenant-${spec.slug}-tls`,
          issuerRef: {
            name: "letsencrypt-production",
            kind: "ClusterIssuer",
          },
          dnsNames: [spec.domain],
        },
      };

      await customApi.createNamespacedCustomObject({
        group: "cert-manager.io",
        version: "v1",
        namespace: spec.namespace,
        plural: "certificates",
        body: certResource,
      });

      logger.info(
        `[K8sCert] Created certificate for ${spec.domain} (tenant: ${spec.slug})`,
      );
      return true;
    } catch (error) {
      logger.error(
        `[K8sCert] Failed to create certificate for ${spec.domain}:`,
        error,
      );
      return false;
    }
  }

  /** Delete the cert-manager Certificate resource for a tenant. */
  async deleteCertificate(slug: string): Promise<boolean> {
    try {
      const { KubeConfig, CustomObjectsApi } =
        await import("@kubernetes/client-node");
      const kc = new KubeConfig();
      kc.loadFromCluster();
      const customApi = kc.makeApiClient(CustomObjectsApi);

      await customApi.deleteNamespacedCustomObject({
        group: "cert-manager.io",
        version: "v1",
        namespace: this.namespace,
        plural: "certificates",
        name: `tenant-${slug}-tls`,
      });

      logger.info(`[K8sCert] Deleted certificate for tenant: ${slug}`);
      return true;
    } catch (error) {
      logger.error(
        `[K8sCert] Failed to delete certificate for ${slug}:`,
        error,
      );
      return false;
    }
  }

  /** Check whether the cert-manager Certificate for a tenant has reached Ready=True. */
  async checkCertificateReady(slug: string): Promise<boolean> {
    try {
      const { KubeConfig, CustomObjectsApi } =
        await import("@kubernetes/client-node");
      const kc = new KubeConfig();
      kc.loadFromCluster();
      const customApi = kc.makeApiClient(CustomObjectsApi);

      const cert = (await customApi.getNamespacedCustomObject({
        group: "cert-manager.io",
        version: "v1",
        namespace: this.namespace,
        plural: "certificates",
        name: `tenant-${slug}-tls`,
      })) as {
        status?: {
          conditions?: Array<{ type: string; status: string }>;
        };
      };

      const conditions = cert.status?.conditions || [];
      return conditions.some((c) => c.type === "Ready" && c.status === "True");
    } catch {
      return false;
    }
  }
}
