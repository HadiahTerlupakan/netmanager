export type OltCommandResultType = "SUCCESS" | "FAILED" | "TIMEOUT" | "PENDING";

export interface OltCommandLog {
  id: string;
  tenantId: string;
  oltId: string;
  onuId: string | null;
  command: string;
  params: Record<string, unknown>;
  result: OltCommandResultType;
  errorMsg: string | null;
  executedBy: string;
  executedAt: Date;
}
