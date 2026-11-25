import { useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomeView } from './components/HomeView';
import { IncomingCallModal } from './components/IncomingCallModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SignInView } from './components/SignInView';
import { UsernameSetupView } from './components/UsernameSetupView';
import { VideoCallView } from './components/VideoCallView';
import { useAuth } from './hooks/useAuth';
import { useCallHistory } from './hooks/useCallHistory';
import { useSocialDirectory } from './hooks/useSocialDirectory';
import { useWebRTCCall, type CallTargetPeer } from './hooks/useWebRTCCall';
import { generateRoomCode, ROOM_CODE_REGEX } from './lib/firebase';
import type { IncomingCallItem } from './types/pulsecall';

function getRoomCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('room')?.trim().toUpperCase();
  return raw && ROOM_CODE_REGEX.test(raw) ? raw : null;
}

function PulseCallApp() {
  const {
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
  } = useAuth();

  const { calls, loading: callsLoading, createCallLog, updateCallLog, deleteCallLog } =
    useCallHistory(user, authReady);

  const {
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
  } = useSocialDirectory(user, userProfile, authReady);

  const [pendingRoomCode, setPendingRoomCode] = useState<string | null>(() =>
    getRoomCodeFromUrl()
  );
  const [isStartingCall, setIsStartingCall] = useState(false);

  const {
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
    clearCallError,
    startCallAsHost,
    callFriend,
    joinCallAsGuest,
    toggleMute,
    toggleCamera,
    switchCamera,
    endCall,
  } = useWebRTCCall({
    user,
    userProfile,
    createCallLog,
    updateCallLog,
  });

  useEffect(() => {
    if (session && pendingRoomCode) {
      setPendingRoomCode(null);
      if (window.location.search) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [session, pendingRoomCode]);

  const handleDismissPendingRoom = () => {
    setPendingRoomCode(null);
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const handleCallFriend = async (peer: CallTargetPeer) => {
    setIsStartingCall(true);
    try {
      await callFriend(peer);
    } finally {
      setIsStartingCall(false);
    }
  };

  const handleStartLinkCall = async () => {
    setIsStartingCall(true);
    try {
      await startCallAsHost(generateRoomCode());
    } finally {
      setIsStartingCall(false);
    }
  };

  const handleJoinCallByLink = async (roomCode: string) => {
    setIsStartingCall(true);
    try {
      await joinCallAsGuest(roomCode);
    } finally {
      setIsStartingCall(false);
    }
  };

  const handleAcceptIncomingCall = async (incoming: IncomingCallItem) => {
    setIsStartingCall(true);
    try {
      await joinCallAsGuest(incoming.roomCode, incoming);
    } finally {
      setIsStartingCall(false);
    }
  };

  if (!authReady || (user && !profileReady)) {
    return (
      <div className="min-h-[100dvh] bg-[#09152B] text-slate-100 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <img
            src="/icon.svg"
            alt="PulseCall"
            referrerPolicy="no-referrer"
            className="h-12 w-12 rounded-2xl animate-pulse"
          />
          <p className="text-sm font-medium text-slate-300">Loading PulseCall...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <SignInView
          pendingRoomCode={pendingRoomCode}
          authLoading={authLoading}
          authError={authError}
          onSignIn={() => void signInWithGoogle()}
        />
        <OfflineIndicator />
      </>
    );
  }

  if (!userProfile?.username) {
    return (
      <>
        <UsernameSetupView
          user={user}
          checkUsernameAvailability={checkUsernameAvailability}
          claimUsername={claimUsername}
          onSignOut={() => void signOut()}
        />
        <OfflineIndicator />
      </>
    );
  }

  if (session) {
    return (
      <>
        <VideoCallView
          session={session}
          localStream={localStream}
          remoteStream={remoteStream}
          connectionState={connectionState}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          facingMode={facingMode}
          isSwitchingCamera={isSwitchingCamera}
          elapsedSeconds={elapsedSeconds}
          callError={callError}
          userPhotoUrl={userProfile.photoURL || (user.photoURL ?? undefined)}
          userName={userProfile.displayName}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onSwitchCamera={() => void switchCamera()}
          onEndCall={() => void endCall()}
        />
        <OfflineIndicator />
      </>
    );
  }

  const activeIncomingCall = incomingCalls[0] ?? null;

  return (
    <>
      <HomeView
        user={user}
        userProfile={userProfile}
        pendingRoomCode={pendingRoomCode}
        onDismissPendingRoom={handleDismissPendingRoom}
        contacts={contacts}
        contactsLoading={contactsLoading}
        friendRequests={friendRequests}
        searchResults={searchResults}
        searchLoading={searchLoading}
        calls={calls}
        callsLoading={callsLoading}
        isStartingCall={isStartingCall}
        callError={callError}
        onClearError={clearCallError}
        onSearchPeople={(q) => void searchPeople(q)}
        onAddFriend={addFriend}
        onAcceptFriendRequest={acceptFriendRequest}
        onDismissFriendRequest={dismissFriendRequest}
        onRemoveContact={removeContact}
        onCallFriend={(peer) => void handleCallFriend(peer)}
        onStartLinkCall={() => void handleStartLinkCall()}
        onJoinCallByLink={(code) => void handleJoinCallByLink(code)}
        onDeleteHistoryItem={(callId) => void deleteCallLog(user.uid, callId)}
        onSignOut={() => void signOut()}
      />

      {activeIncomingCall && (
        <IncomingCallModal
          incomingCall={activeIncomingCall}
          isJoining={isStartingCall}
          onAccept={(call) => void handleAcceptIncomingCall(call)}
          onDecline={(call) => void declineIncomingCall(call)}
        />
      )}

      <OfflineIndicator />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <PulseCallApp />
    </ErrorBoundary>
  );
}
