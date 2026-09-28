import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** False until the project is configured; the app then shows setup
 *  instructions rather than a blank screen or a crash. */
export const isConfigured = Boolean(
  config.apiKey && config.projectId && !String(config.apiKey).includes("your-")
);

const app = isConfigured ? initializeApp(config) : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

/** Firebase reports failures as codes; show people something they can act on. */
export function readableAuthError(error) {
  const code = error?.code || "";
  if (code.includes("email-already-in-use")) return "That email already has an account — sign in instead.";
  if (code.includes("invalid-email")) return "That doesn't look like an email address.";
  if (code.includes("weak-password")) return "Passwords need at least 6 characters.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "Wrong email or password.";
  }
  if (code.includes("too-many-requests")) return "Too many tries. Wait a minute and try again.";
  if (code.includes("network-request-failed")) return "Can't reach the server. Check your connection.";
  if (code.includes("operation-not-allowed")) {
    return "Email sign-in is switched off in the Firebase console — turn on Email/Password under Authentication.";
  }
  return error?.message || "That didn't work. Try again.";
}
