import React from 'react';
import { PhoneIncoming, PhoneOff, Video } from 'lucide-react';
import type { IncomingCallItem } from '../types/pulsecall';

interface IncomingCallModalProps {
  incomingCall: IncomingCallItem;
  isJoining: boolean;
  onAccept: (call: IncomingCallItem) => void;
  onDecline: (call: IncomingCallItem) => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  incomingCall,
  isJoining,
  onAccept,
  onDecline,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#040A17]/85 backdrop-blur-md p-4 safe-pb"
      role="dialog"
      aria-modal="true"
      aria-labelledby="incoming-call-name"
    >
      <div className="w-full max-w-sm rounded-3xl bg-[#0F1F3D] border border-[#00E5FF]/40 p-6 sm:p-7 text-center shadow-2xl">
        <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-[#00E5FF]/25 animate-ping" />
          {incomingCall.callerPhotoUrl ? (
            <img
              src={incomingCall.callerPhotoUrl}
              alt={incomingCall.callerName}
              referrerPolicy="no-referrer"
              className="relative h-20 w-20 rounded-full object-cover border-2 border-[#00E5FF]"
            />
          ) : (
            <div className="relative h-20 w-20 rounded-full bg-[#13264A] border-2 border-[#00E5FF] flex items-center justify-center text-2xl font-bold text-[#00E5FF]">
              {incomingCall.callerName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#00E5FF]">
          <PhoneIncoming className="w-3.5 h-3.5" />
          <span>Incoming video call</span>
        </div>

        <h2 id="incoming-call-name" className="mt-1.5 text-2xl font-bold text-white truncate">
          {incomingCall.callerName}
        </h2>
        <p className="mt-0.5 font-mono text-sm text-slate-300">@{incomingCall.callerUsername}</p>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onDecline(incomingCall)}
            disabled={isJoining}
            className="min-h-[54px] rounded-2xl bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Decline</span>
          </button>

          <button
            type="button"
            onClick={() => onAccept(incomingCall)}
            disabled={isJoining}
            className="min-h-[54px] rounded-2xl bg-[#00E5FF] hover:bg-[#33ECFF] active:scale-[0.98] text-[#09152B] font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
          >
            <Video className="w-4 h-4" />
            <span>{isJoining ? 'Joining...' : 'Join Call'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
