import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Skrip deploy (`scripts/deploy/netmanager-deploy.sh`) menerapkan SETIAP
 * `k8s/production/*.yaml` dengan `-n netmanager-production`. Manifes dengan
 * namespace lain membuat kubectl menolak dan deploy berhenti di tengah —
 * kejadian 2026-10-17: HelmChartConfig Traefik (kube-system) diletakkan di sini
 * dan worker tertinggal di image lama. Manifes tingkat cluster tinggal di
 * `k8s/cluster/` dan diterapkan manual.
 */
const PRODUCTION_DIR = resolve(process.cwd(), "k8s/production");
const PRODUCTION_NAMESPACE = "netmanager-production";

function declaredNamespaces(manifest: string): string[] {
  return [
    ...manifest.matchAll(/^\s+namespace:\s*["']?([\w-]+)["']?\s*$/gm),
  ].map((match) => match[1]);
}

describe("namespace manifes produksi", () => {
  const manifests = readdirSync(PRODUCTION_DIR).filter((name) =>
    name.endsWith(".yaml"),
  );

  it.each(manifests)(
    "%s hanya memakai namespace netmanager-production",
    (name) => {
      const manifest = readFileSync(resolve(PRODUCTION_DIR, name), "utf8");
      const foreign = declaredNamespaces(manifest).filter(
        (namespace) => namespace !== PRODUCTION_NAMESPACE,
      );

      expect(foreign).toEqual([]);
    },
  );
});
