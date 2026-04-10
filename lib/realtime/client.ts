import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";

import { app as firebaseApp } from "@/lib/firebase/config";

export function getRealtimeClientServices() {
  if (!firebaseApp) {
    return {
      firebaseApp,
      firestore: null,
      realtimeDatabase: null,
    };
  }

  return {
    firebaseApp,
    firestore: getFirestore(firebaseApp),
    realtimeDatabase: getDatabase(firebaseApp),
  };
}
