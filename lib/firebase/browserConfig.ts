const firebaseBrowserDefaults = {
  apiKey: "AIzaSyDihrl023fOQnXf8oZ7A2rU7YxzJzQN5Lc",
  authDomain: "netmanager-96742.firebaseapp.com",
  databaseURL:
    "https://netmanager-96742-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "netmanager-96742",
  storageBucket: "netmanager-96742.firebasestorage.app",
  messagingSenderId: "43187781340",
  appId: "1:43187781340:web:461fc10875b35538e67e19",
} as const;

function normalizeFirebaseEnv(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return undefined;
  }

  const normalizedValue = trimmedValue.toLowerCase();
  if (normalizedValue === "null" || normalizedValue === "undefined") {
    return undefined;
  }

  return trimmedValue;
}

export function getFirebaseBrowserConfig() {
  return {
    apiKey:
      normalizeFirebaseEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) ??
      firebaseBrowserDefaults.apiKey,
    authDomain:
      normalizeFirebaseEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) ??
      firebaseBrowserDefaults.authDomain,
    databaseURL:
      normalizeFirebaseEnv(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL) ??
      firebaseBrowserDefaults.databaseURL,
    projectId:
      normalizeFirebaseEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) ??
      firebaseBrowserDefaults.projectId,
    storageBucket:
      normalizeFirebaseEnv(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) ??
      firebaseBrowserDefaults.storageBucket,
    messagingSenderId:
      normalizeFirebaseEnv(
        process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      ) ?? firebaseBrowserDefaults.messagingSenderId,
    appId:
      normalizeFirebaseEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID) ??
      firebaseBrowserDefaults.appId,
  };
}
