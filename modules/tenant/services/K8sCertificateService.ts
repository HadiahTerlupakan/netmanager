import { logger } from "@/lib/logger";
import {
  buildTenantTlsSecretName,
  getTenantNamespace,
  loadCustomObjectsApi,
} from "./k8s-client";

interface CertificateSpec {
  slug: string;
  domain: string;
}

export class K8sCertificateService {
  /** Create a cert-manager Certificate resource for a tenant custom domain. */
  async createCertificate(spec: CertificateSpec): Promise<boolean> {
    try {
      const customApi = await loadCustomObjectsApi();

      const certResource = {
        apiVersion: "cert-manager.io/v1",
        kind: "Certificate",
        metadata: {
          name: buildTenantTlsSecretName(spec.slug),
          namespace: getTenantNamespace(),
        },
        spec: {
          secretName: buildTenantTlsSecretName(spec.slug),
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
        namespace: getTenantNamespace(),
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
      const customApi = await loadCustomObjectsApi();

      await customApi.deleteNamespacedCustomObject({
        group: "cert-manager.io",
        version: "v1",
        namespace: getTenantNamespace(),
        plural: "certificates",
        name: buildTenantTlsSecretName(slug),
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
      const customApi = await loadCustomObjectsApi();

      const cert = (await customApi.getNamespacedCustomObject({
        group: "cert-manager.io",
        version: "v1",
        namespace: getTenantNamespace(),
        plural: "certificates",
        name: buildTenantTlsSecretName(slug),
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
