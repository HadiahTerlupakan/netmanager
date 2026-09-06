import { getR2Settings } from "@/lib/utils/r2-client";
import type {
  MobileTopologyEntity,
  MobileTopologyNodeEntity,
} from "../domain/entities/MobileTopologyEntity";
import type { IMobileTopologyRepository } from "../domain/ports/IMobileTopologyRepository";
import { MobileTopologyRepository } from "../repositories/MobileTopologyRepository";

type ParentNode = { id: string; name: string | null; type: string };
type NodeDetail = Record<string, unknown> & { parent?: ParentNode };

export class MobileTopologyService {
  constructor(
    private readonly repository: IMobileTopologyRepository = new MobileTopologyRepository(),
  ) {}

  /** Get enriched mobile topology response data. */
  async getTopology(tenantId: string) {
    const [topology, r2Settings] = await Promise.all([
      this.repository.getTopologyData(tenantId),
      getR2Settings(),
    ]);
    const parentMap = this.buildParentMap(topology);
    const nodes = this.buildNodesWithDetails(topology, parentMap, r2Settings);
    const nodeDetails = this.buildNodeDetails(nodes, parentMap);

    return {
      otbs: this.enrichBasicNodes(topology.otbs, nodeDetails),
      // Selalu kosong: tabel sumbernya tidak pernah ditulis oleh apa pun di
      // aplikasi ini. Topologi yang sebenarnya dikirim lewat `nodes` dan
      // `edges` di bawah. Kunci dipertahankan agar bentuk respons tidak
      // berubah bagi aplikasi mobile.
      odcs: topology.odcs,
      odps: topology.odps,
      joinboxes: topology.joinboxes,
      poles: topology.poles,
      pelanggans: topology.pelanggans,
      kmzFiles: topology.kmzFiles.map((file) =>
        this.resolveKmzUrl(file, r2Settings),
      ),
      nodes,
      edges: topology.mappingEdges.map((edge) => ({
        ...edge,
        waypoints: this.parseWaypoints(edge.waypoints),
      })),
    };
  }

  private buildParentMap(topology: MobileTopologyEntity) {
    const parentMap = new Map<string | null, ParentNode>();

    for (const edge of topology.mappingEdges) {
      const parentNode = topology.mappingNodes.find(
        (node) => node.nodeId === edge.source,
      );
      const targetNode = topology.mappingNodes.find(
        (node) => node.nodeId === edge.target,
      );
      if (!parentNode || !targetNode) {
        continue;
      }

      const parentData = {
        id: parentNode.name || parentNode.nodeId,
        name: parentNode.name,
        type: parentNode.type,
      };
      parentMap.set(targetNode.nodeId, parentData);
      parentMap.set(targetNode.name, parentData);
    }

    return parentMap;
  }

  private buildNodesWithDetails(
    topology: MobileTopologyEntity,
    parentMap: Map<string | null, ParentNode>,
    r2Settings: Awaited<ReturnType<typeof getR2Settings>>,
  ) {
    return topology.mappingNodes.map((node) => {
      const countData = topology.edgeCounts.find(
        (item) => item.source === node.nodeId,
      );
      return {
        ...node,
        usedSlots: countData ? countData._count.source : 0,
        photo: this.resolveStorageUrl(node.photo, r2Settings),
        parent: parentMap.get(node.nodeId),
      };
    });
  }

  private buildNodeDetails(
    nodes: Array<MobileTopologyNodeEntity & Record<string, unknown>>,
    parentMap: Map<string | null, ParentNode>,
  ) {
    const detailsMap = new Map<string | null, NodeDetail>();

    for (const node of nodes) {
      const details = {
        splitter: node.splitter,
        capacity: node.capacity,
        usedSlots: node.usedSlots,
        photo: node.photo,
        inputCoreColor: node.inputCoreColor,
        attenuationInput: node.attenuationIn,
        attenuationOutput: node.attenuationOut,
        parent: parentMap.get(node.nodeId) || parentMap.get(node.name),
      };
      detailsMap.set(node.nodeId, details);
      detailsMap.set(node.name, details);
    }

    return detailsMap;
  }

  private enrichBasicNodes(
    items: Record<string, unknown>[],
    nodeDetails: Map<string | null, NodeDetail>,
  ) {
    return items.map((item) => ({
      ...item,
      ...this.getNodeDetail(item, nodeDetails),
    }));
  }

  private getNodeDetail(
    item: Record<string, unknown>,
    nodeDetails: Map<string | null, NodeDetail>,
  ) {
    return (
      nodeDetails.get(this.asString(item.id)) ||
      nodeDetails.get(this.asString(item.name)) || {
        splitter: null,
        capacity: 0,
        usedSlots: 0,
      }
    );
  }

  private resolveKmzUrl(
    file: Record<string, unknown>,
    r2Settings: Awaited<ReturnType<typeof getR2Settings>>,
  ) {
    return {
      ...file,
      kmlPath: this.resolveStorageUrl(this.asString(file.kmlPath), r2Settings),
    };
  }

  private resolveStorageUrl(
    value: string | null,
    r2Settings: Awaited<ReturnType<typeof getR2Settings>>,
  ) {
    if (!value || value.startsWith("http") || !r2Settings?.enabled) {
      return value;
    }

    const cleanPath = value.startsWith("/") ? value.substring(1) : value;
    const baseUrl = r2Settings.publicUrl
      ? r2Settings.publicUrl.replace(/\/$/, "")
      : `https://${r2Settings.bucketName}.${r2Settings.accountId}.r2.cloudflarestorage.com`;
    return `${baseUrl}/${cleanPath}`;
  }

  private parseWaypoints(value: string | null): unknown[] {
    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private asString(value: unknown): string | null {
    return typeof value === "string" ? value : null;
  }
}
