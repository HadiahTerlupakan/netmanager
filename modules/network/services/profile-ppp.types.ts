import type { Session } from "next-auth";

export interface SessionContext {
  user: {
    id: string;
    tenantId?: string;
  };
}

export interface CreateProfilePPPInput {
  session: Session | null;
  sessionContext: SessionContext;
  body: Record<string, unknown>;
}

export interface UpdateProfilePPPInput {
  session: Session | null;
  sessionContext: SessionContext;
  id: string;
  body: Record<string, unknown>;
}

export interface DeleteProfilePPPInput {
  session: Session | null;
  id: string;
}

export interface ProfilePPPRepository {
  findProfilePpps(input: ProfilePPPListRepositoryInput): Promise<unknown[]>;
  findProfilePppDetail(id: string): Promise<ProfilePPPDetailRecord | null>;
  findProfilePppForUpdate(id: string): Promise<ProfilePPPRecord | null>;
  findProfilePppForDelete(id: string): Promise<DeleteProfilePPPRecord | null>;
  createProfilePpp(data: Record<string, unknown>): Promise<ProfilePPPRecord>;
  updateProfilePpp(
    id: string,
    data: Record<string, unknown>,
  ): Promise<ProfilePPPRecord>;
  deleteProfilePpp(id: string): Promise<void>;
  findRoutersForProfileBroadcast(input: {
    tenantId?: string | null;
    siteId?: string | null;
  }): Promise<Array<{ id: string; name: string }>>;
}

export interface ProfilePPPListRepositoryInput {
  status?: string;
  siteIds?: string[];
  siteId?: string;
}

export interface ProfilePPPDetailRecord {
  id: string;
  remoteAddress: string;
  mikroTikRouterId: string | null;
  mikroTikRouter?: { id: string; name: string } | null;
}

export interface ProfilePPPRecord {
  id: string;
  name: string;
  localAddress: string;
  remoteAddress: string;
  dnsServer: string | null;
  sessionTimeout: number | null;
  idleTimeout: number | null;
  poolMode: string | null;
  description: string | null;
  status: string;
  siteId: string | null;
  mikroTikRouterId: string | null;
  tenantId?: string | null;
  mikroTikRouter?: { id: string; name: string } | null;
}

export interface DeleteProfilePPPRecord {
  id: string;
  name: string;
  remoteAddress: string;
  siteId: string | null;
  mikroTikRouterId: string | null;
  mikroTikRouter: { id: string; name: string } | null;
  hargaPaket: Array<{ id: string; name: string }>;
}

export type DeleteProfilePPPResult =
  | { success: true; message: string }
  | { success: false; status: number; error: string };
