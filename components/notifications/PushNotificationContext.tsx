"use client";

import { createContext, useContext } from "react";
import { useFCM } from "@/hooks/useFCM";

type PushNotificationState = ReturnType<typeof useFCM>;

const PushNotificationContext = createContext<PushNotificationState | null>(
  null,
);

export function PushNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = useFCM();

  return (
    <PushNotificationContext.Provider value={state}>
      {children}
    </PushNotificationContext.Provider>
  );
}

export function usePushNotificationState() {
  const state = useContext(PushNotificationContext);

  if (!state) {
    throw new Error(
      "usePushNotificationState must be used within PushNotificationProvider",
    );
  }

  return state;
}
