import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType, sanitizeField, USERNAME_REGEX } from '../lib/firebase';
import type { CallHistoryItem, CallHistoryStatus, CallRole } from '../types/pulsecall';

export function useCallHistory(user: User | null, authReady: boolean) {
  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setCalls([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const path = `users/${user.uid}/calls`;
    const callsQuery = query(
      collection(db, 'users', user.uid, 'calls'),
      where('ownerUid', '==', user.uid),
      limit(30)
    );

    const unsubscribe = onSnapshot(
      callsQuery,
      (snapshot) => {
        const items: CallHistoryItem[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CallHistoryItem, 'id'>),
        }));
        items.sort((a, b) => {
          const aSec = a.startedAt?.seconds ?? Date.now() / 1000;
          const bSec = b.startedAt?.seconds ?? Date.now() / 1000;
          return bSec - aSec;
        });
        setCalls(items.slice(0, 15));
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );

    return unsubscribe;
  }, [user, authReady]);

  const createCallLog = useCallback(
    async (params: {
      uid: string;
      callId: string;
      roomCode: string;
      role: CallRole;
      peerUid?: string;
      peerUsername?: string;
      peerName: string;
      peerPhotoUrl?: string;
    }) => {
      const path = `users/${params.uid}/calls/${params.callId}`;
      const payload: Record<string, unknown> = {
        ownerUid: params.uid,
        roomCode: params.roomCode,
        role: params.role,
        peerName: sanitizeField(params.peerName, 100, 'Guest'),
        peerPhotoUrl: sanitizeField(params.peerPhotoUrl, 500, ''),
        status: 'ongoing',
        durationSeconds: 0,
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (params.peerUid) {
        payload.peerUid = sanitizeField(params.peerUid, 128, '');
      }
      if (params.peerUsername && USERNAME_REGEX.test(params.peerUsername)) {
        payload.peerUsername = params.peerUsername;
      }

      try {
        await setDoc(doc(db, 'users', params.uid, 'calls', params.callId), payload);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    []
  );

  const updateCallLog = useCallback(
    async (params: {
      uid: string;
      callId: string;
      peerUid?: string;
      peerUsername?: string;
      peerName?: string;
      peerPhotoUrl?: string;
      status?: CallHistoryStatus;
      durationSeconds?: number;
      ended?: boolean;
    }) => {
      const path = `users/${params.uid}/calls/${params.callId}`;
      const payload: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };
      if (params.peerUid) {
        payload.peerUid = sanitizeField(params.peerUid, 128, '');
      }
      if (params.peerUsername && USERNAME_REGEX.test(params.peerUsername)) {
        payload.peerUsername = params.peerUsername;
      }
      if (params.peerName !== undefined) {
        payload.peerName = sanitizeField(params.peerName, 100, 'Guest');
      }
      if (params.peerPhotoUrl !== undefined) {
        payload.peerPhotoUrl = sanitizeField(params.peerPhotoUrl, 500, '');
      }
      if (params.status !== undefined) {
        payload.status = params.status;
      }
      if (params.durationSeconds !== undefined) {
        payload.durationSeconds = Math.max(0, Math.min(86400, Math.floor(params.durationSeconds)));
      }
      if (params.ended) {
        payload.endedAt = serverTimestamp();
      }
      try {
        await updateDoc(doc(db, 'users', params.uid, 'calls', params.callId), payload);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    []
  );

  const deleteCallLog = useCallback(async (uid: string, callId: string) => {
    const path = `users/${uid}/calls/${callId}`;
    try {
      await deleteDoc(doc(db, 'users', uid, 'calls', callId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }, []);

  return {
    calls,
    loading,
    createCallLog,
    updateCallLog,
    deleteCallLog,
  };
}
