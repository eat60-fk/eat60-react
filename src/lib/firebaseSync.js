import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseConfig, isFirebaseSyncConfigured } from './firebaseConfig';

const app = isFirebaseSyncConfigured
  ? getApps().find(existingApp => existingApp.name === 'eat60') || initializeApp(firebaseConfig, 'eat60')
  : null;
const firebaseAuth = app ? getAuth(app) : null;
const firestore = app ? getFirestore(app) : null;

// Exchange the Google ID token for a Firebase Auth session.
export async function createFirebaseSession(googleIdToken) {
  if (!firebaseAuth) throw new Error('Firebase is not configured for this app.');

  const credential = GoogleAuthProvider.credential(googleIdToken);
  const { user } = await signInWithCredential(firebaseAuth, credential);
  if (!user.email || !user.emailVerified) {
    throw new Error('Google must provide a verified email before account sync can continue.');
  }
  return user;
}

// Mirror basic identity fields; Supabase remains the source for app data and permissions.
export async function syncFirebaseProfile(firebaseUser, supabaseUser) {
  if (!firestore) throw new Error('Firestore is not configured for this app.');

  const email = String(firebaseUser.email || '').trim();
  const supabaseEmail = String(supabaseUser.email || '').trim().toLowerCase();
  if (!email || email.toLowerCase() !== supabaseEmail) {
    throw new Error('The Google and EAT60 account emails do not match.');
  }

  const displayName = String(supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || '').trim();
  const photoURL = String(supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture || '').trim();
  await setDoc(doc(firestore, 'users', firebaseUser.uid), {
    email,
    supabaseUserId: supabaseUser.id,
    displayName,
    photoURL,
    updatedAt: serverTimestamp()
  }, { merge: true });
}
