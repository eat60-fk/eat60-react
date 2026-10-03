# Google sign-in and Firestore profile sync

EAT60 keeps authentication, orders, rewards, and permissions in Supabase. Google sign-in uses the same verified Google email for both services. Firestore stores a small profile mirror at `users/{Firebase UID}` with the matching Supabase UUID; Supabase UUIDs remain the app's database keys.

## Configure Firebase and Google

1. Create or choose a Firebase project, enable **Authentication → Google**, and create a **Cloud Firestore** database.
2. In the Firebase project settings, register the EAT60 web app. Add its web API key and project ID to the local environment listed below.
3. Create a Google OAuth **Web application** client ID for the same Google project. Add the deployed EAT60 origin and local development origin (for example `http://localhost:5173`) to its authorized JavaScript origins.
4. In Supabase, enable the Google provider and configure it with the same Google OAuth client ID and client secret. Add the deployed callback URL shown by Supabase to the OAuth client's authorized redirect URIs.
5. Copy `.env.example` to `.env` and set `VITE_GOOGLE_CLIENT_ID`, `VITE_FIREBASE_API_KEY`, and `VITE_FIREBASE_PROJECT_ID`. Keep the Supabase URL and anon key as already configured. These are browser app settings; never put a Firebase service account key in this project.
6. Publish [firestore.rules](./firestore.rules) in Firebase Console → Firestore Database → Rules.
7. Restart the app after changing environment settings. Test Google sign-in with an email that is verified by Google and allowed by both provider configurations.

The app signs into Firebase Auth with the Google ID token, signs into Supabase with that same Google ID token, checks that the verified email matches, and then writes the identity mirror to Firestore using the Firebase SDK. If Firestore sync fails, it signs out and reports the error rather than leaving a half-linked session.

Firestore security rules restrict each account to its own profile mirror. The `supabaseUserId` field is a client-side identity reference, not proof for privileged operations. Keep authorization, order data, and rewards in Supabase, where row-level security and server-side checks apply.
