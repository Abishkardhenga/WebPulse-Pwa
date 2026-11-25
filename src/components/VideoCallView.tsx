import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  SwitchCamera,
  PhoneOff,
  Copy,
  Check,
  Share2,
  Volume2,
} from 'lucide-react';
import type { ActiveCallSession } from '../hooks/useWebRTCCall';
import type { CameraFacingMode, ConnectionStateLabel } from '../types/pulsecall';

interface VideoCallViewProps {
  session: ActiveCallSession;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: ConnectionStateLabel;
  isMuted: boolean;
  isCameraOff: boolean;
  facingMode: CameraFacingMode;
  isSwitchingCamera: boolean;
  elapsedSeconds: number;
  callError: string | null;
  userPhotoUrl?: string;
  userName?: string;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onSwitchCamera: () => void;
  onEndCall: () => void;
}

function formatTimer(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getStatusDisplay(state: ConnectionStateLabel): {
  label: string;
  dotClass: string;
} {
  switch (state) {
    case 'connected':
      return { label: 'Connected', dotClass: 'bg-emerald-400' };
    case 'waiting':
      return { label: 'Ringing', dotClass: 'bg-[#00E5FF] animate-pulse' };
    case 'connecting':
    case 'initializing':
      return { label: 'Connecting', dotClass: 'bg-[#00E5FF] animate-pulse' };
    case 'reconnecting':
      return { label: 'Reconnecting', dotClass: 'bg-amber-400 animate-pulse' };
    case 'disconnected':
    case 'ended':
      return { label: 'Disconnected', dotClass: 'bg-red-400' };
  }
}

export const VideoCallView: React.FC<VideoCallViewProps> = ({
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
  userPhotoUrl,
  userName,
  onToggleMute,
  onToggleCamera,
  onSwitchCamera,
  onEndCall,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [copied, setCopied] = useState(false);
  const [needsAudioTap, setNeedsAudioTap] = useState(false);

  const hasRemoteVideo =
    !!remoteStream && remoteStream.getVideoTracks().some((t) => t.readyState === 'live');

  useEffect(() => {
    const videoEl = localVideoRef.current;
    if (!videoEl) return;
    videoEl.srcObject = localStream;
    if (localStream) {
      void videoEl.play().catch(() => {});
    }
  }, [localStream]);

  useEffect(() => {
    const videoEl = remoteVideoRef.current;
    if (!videoEl) return;
    videoEl.srcObject = remoteStream;
    if (remoteStream && remoteStream.getTracks().length > 0) {
      videoEl
        .play()
        .then(() => setNeedsAudioTap(false))
        .catch(() => setNeedsAudioTap(true));
    }
  }, [remoteStream]);

  const handleCopyInvite = async () => {
    const url = `${window.location.origin}/?room=${session.roomCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard errors
    }
  };

  const handleShareInvite = async () => {
    const url = `${window.location.origin}/?room=${session.roomCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my PulseCall video call',
          text: 'Tap to join my 1-on-1 PulseCall video call',
          url,
        });
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }
    await handleCopyInvite();
  };

  const handleResumeRemotePlayback = () => {
    const videoEl = remoteVideoRef.current;
    if (!videoEl) return;
    videoEl
      .play()
      .then(() => setNeedsAudioTap(false))
      .catch(() => {});
  };

  const statusInfo = getStatusDisplay(connectionState);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 h-[100dvh] w-full bg-[#09152B] overflow-hidden select-none"
    >
      {/* Full-Screen Remote Video */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="h-full w-full object-cover bg-[#09152B]"
      />

      {/* Ringing / Waiting Overlay */}
      {(!hasRemoteVideo || connectionState === 'waiting') && (
        <div className="absolute inset-0 flex items-center justify-center px-6 pointer-events-none">
          <div className="w-full max-w-sm rounded-3xl bg-[#0F1F3D]/85 backdrop-blur-md border border-white/10 p-6 text-center shadow-2xl pointer-events-auto">
            {session.peerPhotoUrl ? (
              <img
                src={session.peerPhotoUrl}
                alt={session.peerName}
                referrerPolicy="no-referrer"
                className="h-16 w-16 rounded-full mx-auto object-cover border-2 border-[#00E5FF]"
              />
            ) : (
              <div className="h-16 w-16 rounded-full mx-auto bg-[#13264A] border-2 border-[#00E5FF]/50 flex items-center justify-center text-xl font-bold text-[#00E5FF]">
                {session.peerName.slice(0, 1).toUpperCase()}
              </div>
            )}

            <h2 className="mt-4 text-lg font-bold text-white">{session.peerName}</h2>
            {session.peerUsername && (
              <p className="mt-0.5 font-mono text-xs text-[#00E5FF]">@{session.peerUsername}</p>
            )}
            <p className="mt-1.5 text-sm text-slate-300">
              {connectionState === 'waiting'
                ? session.peerUsername
                  ? 'Ringing on PulseCall...'
                  : 'Share the call link for someone to join'
                : 'Establishing encrypted peer connection...'}
            </p>

            {connectionState === 'waiting' && (
              <div className="mt-5 flex items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void handleCopyInvite()}
                  className="min-h-[44px] flex-1 rounded-xl bg-white/10 border border-white/10 text-xs font-semibold text-white flex items-center justify-center gap-1.5 hover:bg-white/15 transition cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-[#00E5FF]" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void handleShareInvite()}
                  className="min-h-[44px] flex-1 rounded-xl bg-[#00E5FF] text-[#09152B] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#33ECFF] transition cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share Link</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Scrim & Live Status Telemetry */}
      <header className="absolute top-0 inset-x-0 z-20 safe-pt safe-px px-4 sm:px-6 pb-8 bg-gradient-to-b from-[#09152B]/85 via-[#09152B]/40 to-transparent pointer-events-none">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 pointer-events-auto">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusInfo.dotClass}`}
                aria-hidden="true"
              />
              <span className="text-xs sm:text-sm font-semibold text-white truncate">
                {statusInfo.label}
              </span>
              {session.peerUsername && (
                <>
                  <span className="text-slate-400" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-mono text-xs text-[#00E5FF] truncate">
                    @{session.peerUsername}
                  </span>
                </>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-300 truncate">{session.peerName}</p>
          </div>

          <div className="shrink-0 rounded-xl bg-[#0F1F3D]/80 backdrop-blur-md border border-white/10 px-3 py-1.5">
            <span className="font-mono tabular-nums text-sm font-semibold text-white">
              {formatTimer(elapsedSeconds)}
            </span>
          </div>
        </div>
      </header>

      {/* Draggable Picture-in-Picture Local Video Preview */}
      <motion.div
        drag
        dragConstraints={containerRef}
        dragMomentum={false}
        dragElastic={0.08}
        whileDrag={{ scale: 1.03 }}
        className="absolute top-24 right-4 sm:top-24 sm:right-6 z-30 w-28 h-40 sm:w-36 sm:h-52 rounded-2xl bg-[#0F1F3D] border border-white/20 shadow-2xl overflow-hidden touch-none cursor-grab active:cursor-grabbing"
        aria-label="Local camera preview (drag to move)"
      >
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-cover ${facingMode === 'user' ? 'video-mirror' : ''} ${
            isCameraOff ? 'opacity-0' : 'opacity-100'
          }`}
        />
        {isCameraOff && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0F1F3D] p-2 text-center">
            {userPhotoUrl ? (
              <img
                src={userPhotoUrl}
                alt={userName ?? 'You'}
                referrerPolicy="no-referrer"
                className="h-10 w-10 rounded-full object-cover border border-white/15"
              />
            ) : (
              <VideoOff className="w-6 h-6 text-slate-400" />
            )}
            <span className="mt-1.5 text-[11px] font-medium text-slate-300">Camera off</span>
          </div>
        )}
      </motion.div>

      {/* Bottom Controls & Audio Fallback */}
      <div className="absolute bottom-0 inset-x-0 z-20 safe-pb safe-px px-4 sm:px-6 pt-10 bg-gradient-to-t from-[#09152B]/90 via-[#09152B]/55 to-transparent">
        <div className="max-w-md mx-auto flex flex-col items-center gap-3">
          {needsAudioTap && (
            <button
              type="button"
              onClick={handleResumeRemotePlayback}
              className="min-h-[44px] px-4 rounded-xl bg-[#00E5FF] text-[#09152B] text-xs font-bold flex items-center gap-2 shadow-lg cursor-pointer"
            >
              <Volume2 className="w-4 h-4" />
              <span>Tap to enable remote audio</span>
            </button>
          )}

          {callError && (
            <div
              role="alert"
              className="w-full rounded-2xl bg-red-500/90 px-4 py-2.5 text-xs font-medium text-white text-center shadow-lg"
            >
              {callError}
            </div>
          )}

          <div className="w-full rounded-3xl bg-[#0F1F3D]/85 backdrop-blur-md border border-white/10 p-2.5 flex items-center justify-around gap-2 shadow-2xl">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              className={`min-h-[52px] min-w-[52px] flex-1 rounded-2xl flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition cursor-pointer ${
                isMuted
                  ? 'bg-white text-[#09152B]'
                  : 'bg-white/5 text-slate-100 hover:bg-white/10'
              }`}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              <span>{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleCamera}
              aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
              className={`min-h-[52px] min-w-[52px] flex-1 rounded-2xl flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition cursor-pointer ${
                isCameraOff
                  ? 'bg-white text-[#09152B]'
                  : 'bg-white/5 text-slate-100 hover:bg-white/10'
              }`}
            >
              {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              <span>{isCameraOff ? 'Start Cam' : 'Cam Off'}</span>
            </button>

            <button
              type="button"
              onClick={onSwitchCamera}
              disabled={isSwitchingCamera || isCameraOff}
              aria-label="Switch front and back camera"
              className="min-h-[52px] min-w-[52px] flex-1 rounded-2xl bg-white/5 text-slate-100 hover:bg-white/10 disabled:opacity-45 flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition cursor-pointer"
            >
              <SwitchCamera className={`w-5 h-5 ${isSwitchingCamera ? 'animate-spin' : ''}`} />
              <span>Flip</span>
            </button>

            <button
              type="button"
              onClick={onEndCall}
              aria-label="End call"
              className="min-h-[52px] min-w-[56px] flex-1 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-[0.97] text-white flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition cursor-pointer shadow-lg shadow-red-600/25"
            >
              <PhoneOff className="w-5 h-5" />
              <span>End</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
