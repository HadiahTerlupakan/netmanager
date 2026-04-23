import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";

import {
  app as firebaseApp,
  auth as firebaseAuth,
} from "@/lib/firebase/config";

export function getRealtimeClientServices() {
  if (!firebaseApp) {
    return {
      firebaseApp,
      auth: null,
      firestore: null,
      realtimeDatabase: null,
    };
  }

  return {
    firebaseApp,
    auth: firebaseAuth,
    firestore: getFirestore(firebaseApp),
    realtimeDatabase: getDatabase(firebaseApp),
  };
}
