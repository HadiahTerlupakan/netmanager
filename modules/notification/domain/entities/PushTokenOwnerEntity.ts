export interface PushTokenOwnerEntity {
  id: string;
  pushToken: string | null;
}

export interface PushTokenOwnerTokensEntity {
  id: string;
  fcmTokens: string[];
}
