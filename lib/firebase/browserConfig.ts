import { clientLogger } from "@/lib/client-logger";
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

function getFirebaseBrowserEnvValues() {
  return {
    apiKey: normalizeFirebaseEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: normalizeFirebaseEnv(
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    ),
    databaseURL: normalizeFirebaseEnv(
      process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    ),
    projectId: normalizeFirebaseEnv(
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    ),
    storageBucket: normalizeFirebaseEnv(
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    ),
    messagingSenderId: normalizeFirebaseEnv(
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    ),
    appId: normalizeFirebaseEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  };
}

export function getFirebaseBrowserFallbackFields() {
  const envValues = getFirebaseBrowserEnvValues();

  return Object.entries(envValues)
    .filter(([, value]) => !value)
    .map(([fieldName]) => fieldName);
}

export function getFirebaseBrowserConfig() {
  const envValues = getFirebaseBrowserEnvValues();
  const resolvedConfig = {
    apiKey: envValues.apiKey ?? firebaseBrowserDefaults.apiKey,
    authDomain: envValues.authDomain ?? firebaseBrowserDefaults.authDomain,
    databaseURL: envValues.databaseURL ?? firebaseBrowserDefaults.databaseURL,
    projectId: envValues.projectId ?? firebaseBrowserDefaults.projectId,
    storageBucket:
      envValues.storageBucket ?? firebaseBrowserDefaults.storageBucket,
    messagingSenderId:
      envValues.messagingSenderId ?? firebaseBrowserDefaults.messagingSenderId,
    appId: envValues.appId ?? firebaseBrowserDefaults.appId,
  };

  const fallbackFields = getFirebaseBrowserFallbackFields();

  if (process.env.NODE_ENV === "production" && fallbackFields.length > 0) {
    clientLogger.warn(
      `Using bundled Firebase browser config defaults for: ${fallbackFields.join(", ")}`,
    );
  }

  return resolvedConfig;
}
