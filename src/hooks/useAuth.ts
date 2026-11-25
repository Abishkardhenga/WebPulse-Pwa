import { useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  normalizeUsername,
  OperationType,
  sanitizeField,
  USERNAME_REGEX,
} from '../lib/firebase';
import type { UserProfile } from '../types/pulsecall';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const syncUserProfile = useCallback(async (firebaseUser: User) => {
    const userPath = `users/${firebaseUser.uid}`;
    const userRef = doc(db, 'users', firebaseUser.uid);
    const displayName = sanitizeField(firebaseUser.displayName, 100, 'PulseCall User');
    const email = sanitizeField(firebaseUser.email, 254, '');
    const photoURL = sanitizeField(firebaseUser.photoURL, 500, '');

    if (!email) return;

    try {
      const existingSnap = await getDoc(userRef);
      if (!existingSnap.exists()) {
        await setDoc(userRef, {
          uid: firebaseUser.uid,
          displayName,
          email,
          photoURL,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const data = existingSnap.data() as UserProfile;
        // Preserve user's chosen displayName if they already claimed a username, else sync latest
        const nextDisplayName = data.username ? data.displayName : displayName;
        await updateDoc(userRef, {
          displayName: sanitizeField(nextDisplayName, 100, 'PulseCall User'),
          email,
          photoURL,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, userPath);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (!currentUser) {
        setUserProfile(null);
        setProfileReady(true);
        return;
      }
      setProfileReady(false);
      if (currentUser.emailVerified) {
        void syncUserProfile(currentUser);
      }
    });
    return unsubscribe;
  }, [syncUserProfile]);

  useEffect(() => {
    if (!user) return;
    const path = `users/${user.uid}`;
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        if (snapshot.exists()) {
          setUserProfile(snapshot.data() as UserProfile);
        } else {
          setUserProfile(null);
        }
        setProfileReady(true);
      },
      (error) => {
        setProfileReady(true);
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
    return unsub;
  }, [user]);

  const checkUsernameAvailability = useCallback(async (rawHandle: string): Promise<boolean> => {
    const handle = normalizeUsername(rawHandle);
    if (!USERNAME_REGEX.test(handle)) return false;
    try {
      const snap = await getDoc(doc(db, 'usernames', handle));
      return !snap.exists();
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `usernames/${handle}`);
    }
  }, []);

  const claimUsername = useCallback(
    async (rawHandle: string, rawDisplayName: string): Promise<void> => {
      if (!user) throw new Error('You must be signed in to claim a username.');
      const handle = normalizeUsername(rawHandle);
      if (!USERNAME_REGEX.test(handle)) {
        throw new Error(
          'Username must be 3–24 characters using only lowercase letters, numbers, or underscores.'
        );
      }

      const displayName = sanitizeField(rawDisplayName, 100, user.displayName ?? 'PulseCall User');
      const photoURL = sanitizeField(user.photoURL, 500, '');
      const handleRef = doc(db, 'usernames', handle);
      const userRef = doc(db, 'users', user.uid);

      try {
        await runTransaction(db, async (tx) => {
          const existingHandle = await tx.get(handleRef);
          if (existingHandle.exists()) {
            throw new Error(`@${handle} is already taken. Try another username.`);
          }
          const existingUser = await tx.get(userRef);
          if (!existingUser.exists()) {
            throw new Error('User profile is still initializing. Please try again.');
          }
          const userData = existingUser.data() as UserProfile;
          if (userData.username) {
            throw new Error(`You already claimed @${userData.username}.`);
          }

          tx.set(handleRef, {
            username: handle,
            uid: user.uid,
            displayName,
            photoURL,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          tx.update(userRef, {
            username: handle,
            displayName,
            photoURL,
            updatedAt: serverTimestamp(),
          });
        });
      } catch (error) {
        if (error instanceof Error && (error.message.includes('already taken') || error.message.includes('already claimed'))) {
          throw error;
        }
        handleFirestoreError(error, OperationType.WRITE, `usernames/${handle}`);
      }
    },
    [user]
  );

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user && result.user.emailVerified) {
        await syncUserProfile(result.user);
      }
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in was cancelled. Tap Continue with Google to try again.');
      } else if (code === 'auth/popup-blocked') {
        setAuthError(
          'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.'
        );
      } else {
        setAuthError(error instanceof Error ? error.message : 'Unable to sign in with Google.');
      }
    } finally {
      setAuthLoading(false);
    }
  }, [syncUserProfile]);

  const signOut = useCallback(async () => {
    setAuthError(null);
    await firebaseSignOut(auth);
  }, []);

  return {
    user,
    userProfile,
    authReady,
    profileReady,
    authLoading,
    authError,
    checkUsernameAvailability,
    claimUsername,
    signInWithGoogle,
    signOut,
  };
}
