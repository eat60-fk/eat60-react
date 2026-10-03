// Public Firebase web settings identify the project; no server secret belongs in the browser.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()
};

export const isFirebaseSyncConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.googleClientId
);
