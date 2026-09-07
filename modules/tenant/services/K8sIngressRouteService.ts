import { logger } from "@/lib/logger";
import {
  buildTenantResourceName,
  buildTenantTlsSecretName,
  getTenantNamespace,
  loadCustomObjectsApi,
} from "./k8s-client";

/**
 * Route Traefik per domain kustom tenant.
 *
 * cert-manager hanya menyimpan sertifikat sebagai Secret; Traefik menyajikan
 * sebuah sertifikat hanya bila ada route yang merujuk Secret itu. IngressRoute
 * catch-all memakai `tls: {}` tanpa `secretName`, jadi tanpa route khusus ini
 * domain tenant dilayani dengan sertifikat bawaan Traefik (self-signed) —
 * terverifikasi lewat `openssl s_client` dengan SNI domain asing yang membalas
 * `CN=TRAEFIK DEFAULT CERT`.
 */

const TRAEFIK_GROUP = "traefik.io";
const TRAEFIK_VERSION = "v1alpha1";
const INGRESS_ROUTE_PLURAL = "ingressroutes";
const APP_SERVICE_NAME = "netmanager-app";
const APP_SERVICE_PORT = 80;

/**
 * Catch-all memakai prioritas 1 (terendah). Route domain tenant harus menang
 * atasnya supaya TLS-nya yang dipakai, bukan sertifikat bawaan.
 */
const TENANT_ROUTE_PRIORITY = 100;

const CONFLICT_STATUS = 409;

interface IngressRouteSpec {
  slug: string;
  domain: string;
}

function buildIngressRoute(spec: IngressRouteSpec, namespace: string) {
  return {
    apiVersion: `${TRAEFIK_GROUP}/${TRAEFIK_VERSION}`,
    kind: "IngressRoute",
    metadata: {
      name: buildTenantResourceName(spec.slug),
      namespace,
    },
    spec: {
      entryPoints: ["websecure"],
      routes: [
        {
          match: `Host(\`${spec.domain}\`)`,
          kind: "Rule",
          priority: TENANT_ROUTE_PRIORITY,
          services: [{ name: APP_SERVICE_NAME, port: APP_SERVICE_PORT }],
        },
      ],
      tls: { secretName: buildTenantTlsSecretName(spec.slug) },
    },
  };
}

function isConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number; statusCode?: number }).code === CONFLICT_STATUS
  );
}

export class K8sIngressRouteService {
  /**
   * Pasang route TLS untuk domain tenant.
   *
   * Nama route mengikuti slug sehingga stabil; domain yang diganti menimpa
   * route lama alih-alih meninggalkan route yatim.
   */
  async upsertRoute(spec: IngressRouteSpec): Promise<boolean> {
    const namespace = getTenantNamespace();

    try {
      const api = await loadCustomObjectsApi();
      const body = buildIngressRoute(spec, namespace);
      const request = {
        group: TRAEFIK_GROUP,
        version: TRAEFIK_VERSION,
        namespace,
        plural: INGRESS_ROUTE_PLURAL,
      };

      try {
        await api.createNamespacedCustomObject({ ...request, body });
      } catch (error) {
        if (!isConflict(error)) throw error;

        await api.replaceNamespacedCustomObject({
          ...request,
          name: buildTenantResourceName(spec.slug),
          body,
        });
      }

      logger.info(
        `[K8sIngressRoute] Route TLS siap untuk ${spec.domain} (tenant: ${spec.slug})`,
      );
      return true;
    } catch (error) {
      logger.error(
        `[K8sIngressRoute] Gagal memasang route untuk ${spec.domain}:`,
        error,
      );
      return false;
    }
  }

  /** Lepas route TLS milik tenant. */
  async deleteRoute(slug: string): Promise<boolean> {
    const namespace = getTenantNamespace();

    try {
      const api = await loadCustomObjectsApi();
      await api.deleteNamespacedCustomObject({
        group: TRAEFIK_GROUP,
        version: TRAEFIK_VERSION,
        namespace,
        plural: INGRESS_ROUTE_PLURAL,
        name: buildTenantResourceName(slug),
      });

      logger.info(`[K8sIngressRoute] Route dihapus untuk tenant: ${slug}`);
      return true;
    } catch (error) {
      logger.error(
        `[K8sIngressRoute] Gagal menghapus route untuk ${slug}:`,
        error,
      );
      return false;
    }
  }
}
