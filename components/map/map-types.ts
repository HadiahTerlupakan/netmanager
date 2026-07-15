import type { MappingNode as PrismaMappingNode } from "@prisma/client";

export type NodeMetadata = {
  poleSize?: string;
  hasSlack?: boolean;
  closureType?: string;
  [key: string]: unknown;
};

export type MappingNode = PrismaMappingNode & {
  attenuationIn?: number | null;
  attenuationOut?: number | null;
  inputCoreColor?: string | null;
  photo?: string | null;
  metadata?: NodeMetadata | null;
  siteId?: string | null;
};

export type FiberFormData = {
  source: string;
  target: string;
  fiberType: string;
  waypoints: [number, number][];
};
