import type { ChatActor, ChatActorType } from "../domain/entities/ChatEntity";

const ACTOR_TYPE_BY_ROLE: Record<string, ChatActorType> = {
  MITRA: "mitra",
  CUSTOMER: "customer",
};

/** Resolve session user menjadi ChatActor — mitra/pelanggan jadi non-user actor. */
export function resolveChatActor(session: {
  id: string;
  role?: string | null;
}): ChatActor {
  const type = ACTOR_TYPE_BY_ROLE[session.role ?? ""] ?? "user";
  return { type, id: session.id };
}
