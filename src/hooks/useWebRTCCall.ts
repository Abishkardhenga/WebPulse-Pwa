import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  db,
  generateRoomCode,
  handleFirestoreError,
  OperationType,
  ROOM_CODE_REGEX,
  sanitizeField,
  USERNAME_REGEX,
} from '../lib/firebase';
import type {
  CallHistoryStatus,
  CallRole,
  CallRoom,
  CameraFacingMode,
  ConnectionStateLabel,
  IncomingCallItem,
  UserProfile,
} from '../types/pulsecall';

const RTC_CONFIG: RTCConfiguration & { sdpSemantics?: string } = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
  sdpSemantics: 'unified-plan',
};

export interface CallTargetPeer {
  uid: string;
  username?: string;
  displayName: string;
  photoURL: string;
}

interface UseWebRTCCallOptions {
  user: User | null;
  userProfile: UserProfile | null;
  createCallLog: (params: {
    uid: string;
    callId: string;
    roomCode: string;
    role: CallRole;
    peerUid?: string;
    peerUsername?: string;
    peerName: string;
    peerPhotoUrl?: string;
  }) => Promise<void>;
  updateCallLog: (params: {
    uid: string;
    callId: string;
    peerUid?: string;
    peerUsername?: string;
    peerName?: string;
    peerPhotoUrl?: string;
    status?: CallHistoryStatus;
    durationSeconds?: number;
    ended?: boolean;
  }) => Promise<void>;
}

export interface ActiveCallSession {
  roomCode: string;
  role: CallRole;
  peerName: string;
  peerUsername?: string;
  peerPhotoUrl: string;
}

export function useWebRTCCall({
  user,
  userProfile,
  createCallLog,
  updateCallLog,
}: UseWebRTCCallOptions) {
  const [session, setSession] = useState<ActiveCallSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionStateLabel>('initializing');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [facingMode, setFacingMode] = useState<CameraFacingMode>('user');
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [callError, setCallError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const unsubsRef = useRef<Unsubscribe[]>([]);
  const pendingRemoteIceRef = useRef<RTCIceCandidateInit[]>([]);
  const processedCandidateIdsRef = useRef<Set<string>>(new Set());
  const remoteDescriptionSetRef = useRef(false);
  const callIdRef = useRef<string | null>(null);
  const sessionRef = useRef<ActiveCallSession | null>(null);
  const ringingTargetRef = useRef<{ calleeUid: string; roomCode: string } | null>(null);
  const elapsedRef = useRef(0);
  const wasConnectedRef = useRef(false);
  const endingRef = useRef(false);

  const clearTimer = useCallback(() => {
    elapsedRef.current = 0;
    setElapsedSeconds(0);
  }, []);

  useEffect(() => {
    if (connectionState !== 'connected') return;
    wasConnectedRef.current = true;
    const interval = window.setInterval(() => {
      elapsedRef.current += 1;
      setElapsedSeconds(elapsedRef.current);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [connectionState]);

  const cleanupMediaAndPeer = useCallback(() => {
    for (const unsub of unsubsRef.current) {
      unsub();
    }
    unsubsRef.current = [];

    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        track.stop();
      }
      localStreamRef.current = null;
    }

    if (remoteStreamRef.current) {
      for (const track of remoteStreamRef.current.getTracks()) {
        track.stop();
      }
      remoteStreamRef.current = null;
    }

    pendingRemoteIceRef.current = [];
    processedCandidateIdsRef.current.clear();
    remoteDescriptionSetRef.current = false;

    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setFacingMode('user');
  }, []);

  useEffect(() => {
    return () => {
      cleanupMediaAndPeer();
    };
  }, [cleanupMediaAndPeer]);

  const formatMediaError = (err: unknown): string => {
    if (err instanceof DOMException) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        return 'Camera and microphone access was denied. On iPhone, open Settings > Safari and allow Camera & Microphone, then try again.';
      }
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        return 'No camera or microphone was detected on this device.';
      }
      if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        return 'Your camera or microphone is currently in use by another app. Close other video apps and try again.';
      }
    }
    return err instanceof Error ? err.message : 'Could not access camera and microphone.';
  };

  const acquireUserMedia = async (mode: CameraFacingMode): Promise<MediaStream> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        'Camera and microphone require HTTPS in Safari/Chrome. Open PulseCall over HTTPS to place a call.'
      );
    }

    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
    } catch (err) {
      if (
        err instanceof DOMException &&
        (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError')
      ) {
        return await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { facingMode: mode },
        });
      }
      throw err;
    }
  };

  const flushRemoteCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !remoteDescriptionSetRef.current) return;
    while (pendingRemoteIceRef.current.length > 0) {
      const candidate = pendingRemoteIceRef.current.shift();
      if (candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('Ignored stale ICE candidate:', err);
        }
      }
    }
  }, []);

  const setupPeerConnection = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }

    const remote = new MediaStream();
    remoteStreamRef.current = remote;
    setRemoteStream(remote);

    pc.ontrack = (event) => {
      const targetStream = remoteStreamRef.current ?? new MediaStream();
      if (event.streams && event.streams[0]) {
        for (const track of event.streams[0].getTracks()) {
          if (!targetStream.getTracks().some((t) => t.id === track.id)) {
            targetStream.addTrack(track);
          }
        }
      } else if (event.track) {
        if (!targetStream.getTracks().some((t) => t.id === event.track.id)) {
          targetStream.addTrack(event.track);
        }
      }
      remoteStreamRef.current = targetStream;
      setRemoteStream(new MediaStream(targetStream.getTracks()));
    };

    const syncConnectionStatus = () => {
      const state = pc.connectionState;
      const ice = pc.iceConnectionState;
      if (state === 'connected' || ice === 'connected' || ice === 'completed') {
        setConnectionState('connected');
      } else if (state === 'connecting' || ice === 'checking') {
        setConnectionState((prev) => (prev === 'connected' ? 'reconnecting' : 'connecting'));
      } else if (ice === 'disconnected') {
        setConnectionState('reconnecting');
      } else if (state === 'failed' || ice === 'failed' || state === 'closed') {
        setConnectionState('disconnected');
      }
    };

    pc.onconnectionstatechange = syncConnectionStatus;
    pc.oniceconnectionstatechange = syncConnectionStatus;

    return pc;
  }, []);

  const finalizeHistoryOnExit = useCallback(
    async (currentUser: User, callId: string | null) => {
      if (!callId) return;
      try {
        await updateCallLog({
          uid: currentUser.uid,
          callId,
          status: wasConnectedRef.current ? 'completed' : 'cancelled',
          durationSeconds: elapsedRef.current,
          ended: true,
        });
      } catch (err) {
        console.warn('Could not finalize call history entry:', err);
      }
    },
    [updateCallLog]
  );

  const endCall = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;

    const activeSession = sessionRef.current;
    const activeCallId = callIdRef.current;
    const ringTarget = ringingTargetRef.current;

    if (user && activeSession) {
      const roomRef = doc(db, 'rooms', activeSession.roomCode);
      try {
        const snap = await getDoc(roomRef);
        if (snap.exists() && snap.data().status !== 'ended') {
          await updateDoc(roomRef, {
            status: 'ended',
            endedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn('Room end update skipped:', err);
      }

      if (ringTarget && !wasConnectedRef.current) {
        try {
          const ringRef = doc(
            db,
            'users',
            ringTarget.calleeUid,
            'incomingCalls',
            ringTarget.roomCode
          );
          const ringSnap = await getDoc(ringRef);
          if (ringSnap.exists() && ringSnap.data().status === 'ringing') {
            await updateDoc(ringRef, {
              status: 'cancelled',
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          console.warn('Incoming ring cancel skipped:', err);
        }
      }

      await finalizeHistoryOnExit(user, activeCallId);
    }

    cleanupMediaAndPeer();
    clearTimer();
    sessionRef.current = null;
    callIdRef.current = null;
    ringingTargetRef.current = null;
    wasConnectedRef.current = false;
    setConnectionState('ended');
    setSession(null);
    endingRef.current = false;
  }, [user, cleanupMediaAndPeer, clearTimer, finalizeHistoryOnExit]);

  const subscribeToRemoteHangup = useCallback(
    (roomCode: string, onRoomData?: (room: CallRoom) => void) => {
      const roomPath = `rooms/${roomCode}`;
      const unsubRoom = onSnapshot(
        doc(db, 'rooms', roomCode),
        (snapshot) => {
          if (!snapshot.exists()) return;
          const room = snapshot.data() as CallRoom;
          onRoomData?.(room);
          if (room.status === 'ended' && !endingRef.current) {
            endingRef.current = true;
            const currentCallId = callIdRef.current;
            if (user && currentCallId) {
              void finalizeHistoryOnExit(user, currentCallId);
            }
            cleanupMediaAndPeer();
            clearTimer();
            sessionRef.current = null;
            callIdRef.current = null;
            ringingTargetRef.current = null;
            wasConnectedRef.current = false;
            setConnectionState('ended');
            setSession(null);
            endingRef.current = false;
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, roomPath);
        }
      );
      unsubsRef.current.push(unsubRoom);
    },
    [user, cleanupMediaAndPeer, clearTimer, finalizeHistoryOnExit]
  );

  const subscribeToRemoteCandidates = useCallback(
    (roomCode: string, subcollectionName: 'callerCandidates' | 'calleeCandidates') => {
      const path = `rooms/${roomCode}/${subcollectionName}`;
      const unsub = onSnapshot(
        collection(db, 'rooms', roomCode, subcollectionName),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type !== 'added') return;
            if (processedCandidateIdsRef.current.has(change.doc.id)) return;
            processedCandidateIdsRef.current.add(change.doc.id);

            const data = change.doc.data();
            const candidateInit: RTCIceCandidateInit = {
              candidate: data.candidate,
              sdpMid: data.sdpMid ?? '',
              sdpMLineIndex: typeof data.sdpMLineIndex === 'number' ? data.sdpMLineIndex : 0,
            };

            if (remoteDescriptionSetRef.current && pcRef.current) {
              void pcRef.current.addIceCandidate(new RTCIceCandidate(candidateInit)).catch((err) => {
                console.warn('Failed to add remote ICE candidate:', err);
              });
            } else {
              pendingRemoteIceRef.current.push(candidateInit);
            }
          });
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, path);
        }
      );
      unsubsRef.current.push(unsub);
    },
    []
  );

  const startCallAsHost = useCallback(
    async (rawCode: string, targetPeer?: CallTargetPeer): Promise<boolean> => {
      if (!user) {
        setCallError('Please sign in with Google before starting a call.');
        return false;
      }

      const roomCode = rawCode.trim().toUpperCase();
      if (!ROOM_CODE_REGEX.test(roomCode)) {
        setCallError('Invalid call room identifier.');
        return false;
      }

      setCallError(null);
      cleanupMediaAndPeer();
      clearTimer();
      wasConnectedRef.current = false;
      endingRef.current = false;
      ringingTargetRef.current = null;

      let stream: MediaStream;
      try {
        stream = await acquireUserMedia('user');
      } catch (err) {
        setCallError(formatMediaError(err));
        return false;
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      setFacingMode('user');

      const pc = setupPeerConnection(stream);
      const queuedLocalIce: RTCIceCandidateInit[] = [];
      let roomCreated = false;

      const writeCallerCandidate = async (cand: RTCIceCandidateInit) => {
        if (!cand.candidate) return;
        const candPath = `rooms/${roomCode}/callerCandidates`;
        try {
          await addDoc(collection(db, 'rooms', roomCode, 'callerCandidates'), {
            senderUid: user.uid,
            candidate: cand.candidate.slice(0, 2048),
            sdpMid: sanitizeField(cand.sdpMid, 64, ''),
            sdpMLineIndex:
              typeof cand.sdpMLineIndex === 'number' && cand.sdpMLineIndex >= 0
                ? cand.sdpMLineIndex
                : 0,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, candPath);
        }
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate || !event.candidate.candidate) return;
        const json = event.candidate.toJSON();
        if (!roomCreated) {
          queuedLocalIce.push(json);
        } else {
          void writeCallerCandidate(json);
        }
      };

      const initialSession: ActiveCallSession = {
        roomCode,
        role: 'host',
        peerName: targetPeer ? targetPeer.displayName : 'Waiting for guest...',
        peerUsername: targetPeer?.username,
        peerPhotoUrl: targetPeer?.photoURL ?? '',
      };
      sessionRef.current = initialSession;
      setSession(initialSession);
      setConnectionState('waiting');

      const hostName = sanitizeField(
        userProfile?.displayName ?? user.displayName,
        100,
        'PulseCall Host'
      );
      const hostPhotoUrl = sanitizeField(userProfile?.photoURL ?? user.photoURL, 500, '');
      const hostUsername =
        userProfile?.username && USERNAME_REGEX.test(userProfile.username)
          ? userProfile.username
          : undefined;

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const roomRef = doc(db, 'rooms', roomCode);
        const existingSnap = await getDoc(roomRef);
        if (existingSnap.exists()) {
          throw new Error('This room is already active. Please try calling again.');
        }

        const roomPayload: Record<string, unknown> = {
          code: roomCode,
          hostUid: user.uid,
          hostName,
          hostPhotoUrl,
          status: 'waiting',
          offer: {
            type: 'offer',
            sdp: (offer.sdp ?? '').slice(0, 32768),
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (hostUsername) {
          roomPayload.hostUsername = hostUsername;
        }
        if (targetPeer?.uid) {
          roomPayload.calleeUid = targetPeer.uid;
        }

        await setDoc(roomRef, roomPayload);

        roomCreated = true;
        for (const cand of queuedLocalIce) {
          void writeCallerCandidate(cand);
        }

        // Notify friend in real time if calling a specific contact
        if (targetPeer?.uid && hostUsername) {
          ringingTargetRef.current = { calleeUid: targetPeer.uid, roomCode };
          const ringPath = `users/${targetPeer.uid}/incomingCalls/${roomCode}`;
          try {
            await setDoc(doc(db, 'users', targetPeer.uid, 'incomingCalls', roomCode), {
              roomCode,
              callerUid: user.uid,
              callerUsername: hostUsername,
              callerName: hostName,
              callerPhotoUrl: hostPhotoUrl,
              calleeUid: targetPeer.uid,
              status: 'ringing',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (ringErr) {
            handleFirestoreError(ringErr, OperationType.CREATE, ringPath);
          }
        }

        const callId = `${roomCode}_${Date.now()}`;
        callIdRef.current = callId;
        await createCallLog({
          uid: user.uid,
          callId,
          roomCode,
          role: 'host',
          peerUid: targetPeer?.uid,
          peerUsername: targetPeer?.username,
          peerName: targetPeer ? targetPeer.displayName : 'Waiting for guest',
          peerPhotoUrl: targetPeer?.photoURL ?? '',
        });

        subscribeToRemoteHangup(roomCode, (room) => {
          if (room.answer && !remoteDescriptionSetRef.current && pcRef.current) {
            remoteDescriptionSetRef.current = true;
            const guestName = sanitizeField(room.guestName, 100, targetPeer?.displayName ?? 'Guest');
            const guestPhotoUrl = sanitizeField(
              room.guestPhotoUrl,
              500,
              targetPeer?.photoURL ?? ''
            );

            const nextSession: ActiveCallSession = {
              roomCode,
              role: 'host',
              peerName: guestName,
              peerUsername: targetPeer?.username,
              peerPhotoUrl: guestPhotoUrl,
            };
            sessionRef.current = nextSession;
            setSession(nextSession);
            setConnectionState('connecting');

            if (callIdRef.current) {
              void updateCallLog({
                uid: user.uid,
                callId: callIdRef.current,
                peerUid: room.guestUid ?? targetPeer?.uid,
                peerUsername: targetPeer?.username,
                peerName: guestName,
                peerPhotoUrl: guestPhotoUrl,
              });
            }

            void pcRef.current
              .setRemoteDescription(new RTCSessionDescription(room.answer))
              .then(() => flushRemoteCandidates())
              .catch((err) => {
                console.error('Failed to set remote answer SDP:', err);
                setCallError('Unable to establish peer video connection.');
              });
          }
        });

        subscribeToRemoteCandidates(roomCode, 'calleeCandidates');
        return true;
      } catch (err) {
        cleanupMediaAndPeer();
        sessionRef.current = null;
        ringingTargetRef.current = null;
        setSession(null);
        setCallError(err instanceof Error ? err.message : 'Unable to start video call.');
        return false;
      }
    },
    [
      user,
      userProfile,
      cleanupMediaAndPeer,
      clearTimer,
      setupPeerConnection,
      createCallLog,
      updateCallLog,
      subscribeToRemoteHangup,
      subscribeToRemoteCandidates,
      flushRemoteCandidates,
    ]
  );

  const callFriend = useCallback(
    async (target: CallTargetPeer): Promise<boolean> => {
      const code = generateRoomCode();
      return startCallAsHost(code, target);
    },
    [startCallAsHost]
  );

  const joinCallAsGuest = useCallback(
    async (rawCode: string, incomingCall?: IncomingCallItem): Promise<boolean> => {
      if (!user) {
        setCallError('Please sign in with Google before joining a call.');
        return false;
      }

      const roomCode = rawCode.trim().toUpperCase();
      if (!ROOM_CODE_REGEX.test(roomCode)) {
        setCallError('Invalid call room link.');
        return false;
      }

      setCallError(null);
      cleanupMediaAndPeer();
      clearTimer();
      wasConnectedRef.current = false;
      endingRef.current = false;

      let roomData: CallRoom;
      try {
        const roomSnap = await getDoc(doc(db, 'rooms', roomCode));
        if (!roomSnap.exists()) {
          setCallError('This call room was not found or has expired.');
          return false;
        }
        roomData = roomSnap.data() as CallRoom;
        if (roomData.status === 'ended') {
          setCallError('This call has already ended.');
          return false;
        }
        if (roomData.status !== 'waiting' || roomData.guestUid) {
          setCallError('This 1-on-1 call is already in progress.');
          return false;
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `rooms/${roomCode}`);
      }

      let stream: MediaStream;
      try {
        stream = await acquireUserMedia('user');
      } catch (err) {
        setCallError(formatMediaError(err));
        return false;
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      setFacingMode('user');

      const pc = setupPeerConnection(stream);
      const queuedLocalIce: RTCIceCandidateInit[] = [];
      let guestJoined = false;

      const writeCalleeCandidate = async (cand: RTCIceCandidateInit) => {
        if (!cand.candidate) return;
        const candPath = `rooms/${roomCode}/calleeCandidates`;
        try {
          await addDoc(collection(db, 'rooms', roomCode, 'calleeCandidates'), {
            senderUid: user.uid,
            candidate: cand.candidate.slice(0, 2048),
            sdpMid: sanitizeField(cand.sdpMid, 64, ''),
            sdpMLineIndex:
              typeof cand.sdpMLineIndex === 'number' && cand.sdpMLineIndex >= 0
                ? cand.sdpMLineIndex
                : 0,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, candPath);
        }
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate || !event.candidate.candidate) return;
        const json = event.candidate.toJSON();
        if (!guestJoined) {
          queuedLocalIce.push(json);
        } else {
          void writeCalleeCandidate(json);
        }
      };

      const peerName = sanitizeField(roomData.hostName, 100, 'Host');
      const peerPhotoUrl = sanitizeField(roomData.hostPhotoUrl, 500, '');
      const peerUsername = roomData.hostUsername ?? incomingCall?.callerUsername;
      const initialSession: ActiveCallSession = {
        roomCode,
        role: 'guest',
        peerName,
        peerUsername,
        peerPhotoUrl,
      };
      sessionRef.current = initialSession;
      setSession(initialSession);
      setConnectionState('connecting');

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(roomData.offer));
        remoteDescriptionSetRef.current = true;

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        const guestName = sanitizeField(
          userProfile?.displayName ?? user.displayName,
          100,
          'PulseCall Guest'
        );
        const guestPhotoUrl = sanitizeField(userProfile?.photoURL ?? user.photoURL, 500, '');

        await updateDoc(doc(db, 'rooms', roomCode), {
          guestUid: user.uid,
          guestName,
          guestPhotoUrl,
          answer: {
            type: 'answer',
            sdp: (answer.sdp ?? '').slice(0, 32768),
          },
          status: 'active',
          updatedAt: serverTimestamp(),
        });

        if (incomingCall) {
          try {
            await updateDoc(doc(db, 'users', user.uid, 'incomingCalls', roomCode), {
              status: 'accepted',
              updatedAt: serverTimestamp(),
            });
          } catch (ringErr) {
            console.warn('Could not mark incoming call accepted:', ringErr);
          }
        }

        guestJoined = true;
        for (const cand of queuedLocalIce) {
          void writeCalleeCandidate(cand);
        }

        const callId = `${roomCode}_${Date.now()}`;
        callIdRef.current = callId;
        await createCallLog({
          uid: user.uid,
          callId,
          roomCode,
          role: 'guest',
          peerUid: roomData.hostUid,
          peerUsername,
          peerName,
          peerPhotoUrl,
        });

        subscribeToRemoteHangup(roomCode);
        subscribeToRemoteCandidates(roomCode, 'callerCandidates');
        return true;
      } catch (err) {
        cleanupMediaAndPeer();
        sessionRef.current = null;
        setSession(null);
        setCallError(err instanceof Error ? err.message : 'Unable to join call.');
        return false;
      }
    },
    [
      user,
      userProfile,
      cleanupMediaAndPeer,
      clearTimer,
      setupPeerConnection,
      createCallLog,
      subscribeToRemoteHangup,
      subscribeToRemoteCandidates,
    ]
  );

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    setIsMuted((prev) => {
      const next = !prev;
      for (const track of stream.getAudioTracks()) {
        track.enabled = !next;
      }
      return next;
    });
  }, []);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    setIsCameraOff((prev) => {
      const next = !prev;
      for (const track of stream.getVideoTracks()) {
        track.enabled = !next;
      }
      return next;
    });
  }, []);

  const switchCamera = useCallback(async () => {
    const stream = localStreamRef.current;
    const pc = pcRef.current;
    if (!stream || !pc || isSwitchingCamera) return;

    const nextMode: CameraFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setIsSwitchingCamera(true);
    setCallError(null);

    try {
      const oldVideoTracks = stream.getVideoTracks();
      for (const track of oldVideoTracks) {
        track.stop();
        stream.removeTrack(track);
      }

      let newVideoStream: MediaStream;
      try {
        newVideoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { exact: nextMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch {
        newVideoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextMode },
        });
      }

      const newVideoTrack = newVideoStream.getVideoTracks()[0];
      if (!newVideoTrack) {
        throw new Error('Could not switch to the selected camera.');
      }

      newVideoTrack.enabled = !isCameraOff;

      const videoSender =
        pc
          .getTransceivers()
          .find((t) => t.sender.track?.kind === 'video' || t.receiver.track?.kind === 'video')
          ?.sender ?? pc.getSenders().find((s) => s.track?.kind === 'video');
      if (videoSender) {
        await videoSender.replaceTrack(newVideoTrack);
      }

      const updatedStream = new MediaStream([...stream.getAudioTracks(), newVideoTrack]);
      localStreamRef.current = updatedStream;
      setLocalStream(updatedStream);
      setFacingMode(nextMode);
    } catch (err) {
      setCallError(formatMediaError(err));
    } finally {
      setIsSwitchingCamera(false);
    }
  }, [facingMode, isCameraOff, isSwitchingCamera]);

  return {
    session,
    localStream,
    remoteStream,
    connectionState,
    isMuted,
    isCameraOff,
    facingMode,
    isSwitchingCamera,
    elapsedSeconds,
    callError,
    clearCallError: () => setCallError(null),
    startCallAsHost,
    callFriend,
    joinCallAsGuest,
    toggleMute,
    toggleCamera,
    switchCamera,
    endCall,
  };
}
