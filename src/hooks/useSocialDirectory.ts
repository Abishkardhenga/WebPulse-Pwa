import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  normalizeUsername,
  OperationType,
  sanitizeField,
} from '../lib/firebase';
import type {
  ContactItem,
  FriendRequestItem,
  IncomingCallItem,
  PublicHandle,
  UserProfile,
} from '../types/pulsecall';

export function useSocialDirectory(
  user: User | null,
  userProfile: UserProfile | null,
  authReady: boolean
) {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [friendRequests, setFriendRequests] = useState<FriendRequestItem[]>([]);
  const [incomingCalls, setIncomingCalls] = useState<IncomingCallItem[]>([]);
  const [searchResults, setSearchResults] = useState<PublicHandle[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Contacts listener
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setContacts([]);
      setContactsLoading(false);
      return;
    }

    setContactsLoading(true);
    const path = `users/${user.uid}/contacts`;
    const q = query(
      collection(db, 'users', user.uid, 'contacts'),
      where('ownerUid', '==', user.uid),
      limit(50)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as ContactItem);
        list.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setContacts(list);
        setContactsLoading(false);
      },
      (error) => {
        setContactsLoading(false);
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
    return unsub;
  }, [user, authReady]);

  // Incoming friend requests listener
  useEffect(() => {
    if (!authReady || !user) {
      setFriendRequests([]);
      return;
    }

    const path = `users/${user.uid}/friendRequests`;
    const q = query(
      collection(db, 'users', user.uid, 'friendRequests'),
      where('targetUid', '==', user.uid),
      limit(20)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const pending = snap.docs
          .map((d) => d.data() as FriendRequestItem)
          .filter((item) => item.status === 'pending');
        setFriendRequests(pending);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
    return unsub;
  }, [user, authReady]);

  // Live incoming calls listener
  useEffect(() => {
    if (!authReady || !user) {
      setIncomingCalls([]);
      return;
    }

    const path = `users/${user.uid}/incomingCalls`;
    const q = query(
      collection(db, 'users', user.uid, 'incomingCalls'),
      where('calleeUid', '==', user.uid),
      limit(10)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const nowSec = Date.now() / 1000;
        const activeRings = snap.docs
          .map((d) => d.data() as IncomingCallItem)
          .filter((item) => {
            if (item.status !== 'ringing') return false;
            const createdSec = item.createdAt?.seconds ?? nowSec;
            return nowSec - createdSec < 180;
          });
        activeRings.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        setIncomingCalls(activeRings);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
    return unsub;
  }, [user, authReady]);

  const searchPeople = useCallback(
    async (rawQuery: string) => {
      if (!user) return;
      const clean = normalizeUsername(rawQuery);
      setSearchLoading(true);
      try {
        const handlesRef = collection(db, 'usernames');
        const q = clean
          ? query(
              handlesRef,
              where('username', '>=', clean),
              where('username', '<=', `${clean}\uf8ff`),
              limit(12)
            )
          : query(handlesRef, limit(10));

        const snap = await getDocs(q);
        const items = snap.docs
          .map((d) => d.data() as PublicHandle)
          .filter((h) => h.uid !== user.uid);
        setSearchResults(items);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'usernames');
      } finally {
        setSearchLoading(false);
      }
    },
    [user]
  );

  // Load initial discoverable handles once user has claimed a username
  useEffect(() => {
    if (authReady && user && userProfile?.username) {
      void searchPeople('');
    }
  }, [authReady, user, userProfile?.username, searchPeople]);

  const addFriend = useCallback(
    async (target: PublicHandle) => {
      if (!user || !userProfile?.username) return;
      const contactPath = `users/${user.uid}/contacts/${target.uid}`;
      const contactRef = doc(db, 'users', user.uid, 'contacts', target.uid);

      try {
        const existing = await getDoc(contactRef);
        if (!existing.exists()) {
          await setDoc(contactRef, {
            ownerUid: user.uid,
            contactUid: target.uid,
            username: target.username,
            displayName: sanitizeField(target.displayName, 100, target.username),
            photoURL: sanitizeField(target.photoURL, 500, ''),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(contactRef, {
            displayName: sanitizeField(target.displayName, 100, target.username),
            photoURL: sanitizeField(target.photoURL, 500, ''),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, contactPath);
      }

      if (target.uid !== user.uid) {
        const reqPath = `users/${target.uid}/friendRequests/${user.uid}`;
        const reqRef = doc(db, 'users', target.uid, 'friendRequests', user.uid);
        try {
          const existingReq = await getDoc(reqRef);
          if (!existingReq.exists()) {
            await setDoc(reqRef, {
              targetUid: target.uid,
              senderUid: user.uid,
              senderUsername: userProfile.username,
              senderName: sanitizeField(userProfile.displayName, 100, userProfile.username),
              senderPhotoUrl: sanitizeField(userProfile.photoURL, 500, ''),
              status: 'pending',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (error) {
          // Non-fatal if target already had an entry or request state changed
          console.warn('Friend notification skipped:', reqPath, error);
        }
      }
    },
    [user, userProfile]
  );

  const acceptFriendRequest = useCallback(
    async (req: FriendRequestItem) => {
      if (!user) return;
      const contactPath = `users/${user.uid}/contacts/${req.senderUid}`;
      const reqPath = `users/${user.uid}/friendRequests/${req.senderUid}`;
      try {
        const contactRef = doc(db, 'users', user.uid, 'contacts', req.senderUid);
        const existingContact = await getDoc(contactRef);
        if (!existingContact.exists()) {
          await setDoc(contactRef, {
            ownerUid: user.uid,
            contactUid: req.senderUid,
            username: req.senderUsername,
            displayName: sanitizeField(req.senderName, 100, req.senderUsername),
            photoURL: sanitizeField(req.senderPhotoUrl, 500, ''),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await updateDoc(doc(db, 'users', user.uid, 'friendRequests', req.senderUid), {
          status: 'accepted',
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `${contactPath} | ${reqPath}`);
      }
    },
    [user]
  );

  const dismissFriendRequest = useCallback(
    async (senderUid: string) => {
      if (!user) return;
      const reqPath = `users/${user.uid}/friendRequests/${senderUid}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'friendRequests', senderUid), {
          status: 'dismissed',
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, reqPath);
      }
    },
    [user]
  );

  const removeContact = useCallback(
    async (contactUid: string) => {
      if (!user) return;
      const contactPath = `users/${user.uid}/contacts/${contactUid}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'contacts', contactUid));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, contactPath);
      }
    },
    [user]
  );

  const declineIncomingCall = useCallback(
    async (incoming: IncomingCallItem) => {
      if (!user) return;
      const incomingPath = `users/${user.uid}/incomingCalls/${incoming.roomCode}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'incomingCalls', incoming.roomCode), {
          status: 'declined',
          updatedAt: serverTimestamp(),
        });
        const roomRef = doc(db, 'rooms', incoming.roomCode);
        const roomSnap = await getDoc(roomRef);
        if (roomSnap.exists() && roomSnap.data().status !== 'ended') {
          await updateDoc(roomRef, {
            status: 'ended',
            endedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, incomingPath);
      }
    },
    [user]
  );

  return {
    contacts,
    contactsLoading,
    friendRequests,
    incomingCalls,
    searchResults,
    searchLoading,
    searchPeople,
    addFriend,
    acceptFriendRequest,
    dismissFriendRequest,
    removeContact,
    declineIncomingCall,
  };
}
