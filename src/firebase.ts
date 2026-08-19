import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  User 
} from 'firebase/auth';
import { 
  initializeFirestore, 
  doc, 
  getDoc, 
  getDocFromServer,
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot,
  setLogLevel
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Configure log level to error to avoid benign offline-retry notices in iframe environments
setLogLevel('error');

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Use long-polling and undefined property handling to ensure reliable connections in containerized/iframe environments
export const db = initializeFirestore(
  app,
  {
    experimentalForceLongPolling: true,
    ignoreUndefinedProperties: true,
  },
  firebaseConfig.firestoreDatabaseId
);
export const auth = getAuth(app);

// Connection test on app startup as specified in Firebase guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore running in offline-ready mode.");
    }
  }
}
testConnection();

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
  lastLoginAt: string;
  role: 'admin' | 'user';
  providerId: string;
}

export interface AdminNotification {
  id: string;
  type: string;
  userEmail: string;
  userDisplayName: string;
  userId: string;
  createdAt: string;
  read: boolean;
}

const ADMIN_EMAIL = 'alibertendless999.ko@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Ensures user profile exists in Firestore and updates login timestamps.
 * Offline resilient with local cache fallback.
 */
export async function syncUserProfile(user: User): Promise<{ profile: UserProfile; isNewUser: boolean }> {
  const userRef = doc(db, 'users', user.uid);
  const now = new Date().toISOString();
  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // Local storage cache key
  const cacheKey = `linecraft_user_profile_${user.uid}`;
  let cachedProfile: UserProfile | null = null;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) cachedProfile = JSON.parse(raw);
  } catch {
    // ignore
  }

  const defaultProfile: UserProfile = cachedProfile ? {
    ...cachedProfile,
    lastLoginAt: now,
    displayName: user.displayName || cachedProfile.displayName,
    photoURL: user.photoURL || cachedProfile.photoURL || '',
    role: isAdmin ? 'admin' : cachedProfile.role || 'user',
  } : {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email?.split('@')[0] || 'User',
    photoURL: user.photoURL || '',
    createdAt: now,
    lastLoginAt: now,
    role: isAdmin ? 'admin' : 'user',
    providerId: user.providerData[0]?.providerId || 'password',
  };

  try {
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // New User Registration
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        photoURL: user.photoURL || '',
        createdAt: now,
        lastLoginAt: now,
        role: isAdmin ? 'admin' : 'user',
        providerId: user.providerData[0]?.providerId || 'password',
      };

      try {
        await setDoc(userRef, newProfile);
        localStorage.setItem(cacheKey, JSON.stringify(newProfile));
      } catch (writeErr) {
        handleFirestoreError(writeErr, OperationType.WRITE, `users/${user.uid}`);
      }

      // Create Admin Notification for NEW registration
      try {
        await addDoc(collection(db, 'admin_notifications'), {
          type: 'NEW_USER_REGISTRATION',
          userEmail: newProfile.email,
          userDisplayName: newProfile.displayName,
          userId: newProfile.uid,
          createdAt: now,
          read: false,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'admin_notifications');
      }

      return { profile: newProfile, isNewUser: true };
    } else {
      // Returning user
      const existingData = userSnap.data() as UserProfile;
      const updatedProfile: UserProfile = {
        ...existingData,
        lastLoginAt: now,
        displayName: user.displayName || existingData.displayName,
        photoURL: user.photoURL || existingData.photoURL || '',
        role: isAdmin ? 'admin' : existingData.role || 'user',
      };

      try {
        await setDoc(userRef, updatedProfile, { merge: true });
        localStorage.setItem(cacheKey, JSON.stringify(updatedProfile));
      } catch (writeErr) {
        handleFirestoreError(writeErr, OperationType.UPDATE, `users/${user.uid}`);
      }

      return { profile: updatedProfile, isNewUser: false };
    }
  } catch (error) {
    const isOffline = error instanceof Error && (
      error.message.includes('client is offline') || 
      error.message.includes('backend didn\'t respond') ||
      error.message.includes('unavailable')
    );

    if (!isOffline) {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    }
    
    // Save to local cache & attempt optimistic write in Firestore offline queue
    try {
      localStorage.setItem(cacheKey, JSON.stringify(defaultProfile));
      void setDoc(userRef, defaultProfile, { merge: true }).catch(() => {});
    } catch {
      // ignore
    }

    return { profile: defaultProfile, isNewUser: false };
  }
}

/**
 * Google OAuth Sign In
 */
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const { profile, isNewUser } = await syncUserProfile(result.user);
  return { user: result.user, profile, isNewUser };
}

/**
 * Logout
 */
export async function logOut() {
  await firebaseSignOut(auth);
}

/**
 * Fetch all registered users for Admin View
 */
export async function fetchAllUsers(): Promise<UserProfile[]> {
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    const users: UserProfile[] = [];
    snapshot.forEach(docSnap => {
      users.push(docSnap.data() as UserProfile);
    });
    return users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
    return [];
  }
}

/**
 * Fetch admin notifications
 */
export async function fetchAdminNotifications(): Promise<AdminNotification[]> {
  try {
    const q = query(collection(db, 'admin_notifications'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const list: AdminNotification[] = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() } as AdminNotification);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'admin_notifications');
    return [];
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(id: string) {
  try {
    const ref = doc(db, 'admin_notifications', id);
    await updateDoc(ref, { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `admin_notifications/${id}`);
  }
}
