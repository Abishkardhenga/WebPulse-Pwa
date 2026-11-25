import React from 'react';
import { Video, ShieldCheck, Smartphone, ArrowRight } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface SignInViewProps {
  pendingRoomCode: string | null;
  authLoading: boolean;
  authError: string | null;
  onSignIn: () => void;
}

export const SignInView: React.FC<SignInViewProps> = ({
  pendingRoomCode,
  authLoading,
  authError,
  onSignIn,
}) => {
  return (
    <div className="min-h-[100dvh] bg-[#09152B] text-slate-100 flex flex-col justify-between safe-pt safe-pb safe-px">
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-2 pb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <img
            src="/icon.svg"
            alt="PulseCall emblem"
            referrerPolicy="no-referrer"
            className="h-9 w-9 rounded-xl"
          />
          <span className="font-display text-xl font-bold tracking-tight text-white whitespace-nowrap">
            PulseCall
          </span>
        </div>
        <PWAInstallButton />
      </header>

      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-12 flex-1 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            {pendingRoomCode && (
              <div className="rounded-2xl bg-[#00E5FF]/10 border border-[#00E5FF]/35 p-4 text-sm text-slate-100">
                <p className="font-semibold text-[#00E5FF]">
                  Room invite ready: <span className="font-mono tracking-widest">{pendingRoomCode}</span>
                </p>
                <p className="mt-1 text-slate-300">
                  Sign in with Google below to join this 1-on-1 video call.
                </p>
              </div>
            )}

            <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.1] text-balance">
              Direct 1-on-1 video calls across iPhone and Android.
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-xl leading-relaxed">
              Create an instant 6-character call room, share the link, and connect face-to-face
              directly from iOS Safari or Android Chrome with no app store download.
            </p>

            <div className="pt-2 space-y-3 text-sm text-slate-300">
              <div className="flex items-center gap-3">
                <Video className="w-4 h-4 text-[#00E5FF] shrink-0" />
                <span>Peer-to-peer WebRTC video with front and rear camera switching</span>
              </div>
              <div className="flex items-center gap-3">
                <Smartphone className="w-4 h-4 text-[#00E5FF] shrink-0" />
                <span>Installable PWA tuned for iOS Safari Home Screen and Android Chrome</span>
              </div>
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-[#00E5FF] shrink-0" />
                <span>Private Google Sign-In and personal call history synced in Firestore</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-3xl bg-[#0F1F3D] border border-white/10 p-6 sm:p-8 shadow-2xl">
              <h2 className="text-xl font-bold text-white">Sign in to start calling</h2>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                Use your Google account to host 1-on-1 rooms, join invite codes, and keep your call
                history.
              </p>

              {authError && (
                <div
                  role="alert"
                  className="mt-4 rounded-2xl bg-red-500/15 border border-red-500/30 p-3.5 text-sm text-red-200"
                >
                  {authError}
                </div>
              )}

              <button
                type="button"
                onClick={onSignIn}
                disabled={authLoading}
                className="mt-6 w-full min-h-[52px] rounded-2xl bg-[#00E5FF] text-[#09152B] font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 hover:bg-[#33ECFF] active:scale-[0.98] disabled:opacity-60 transition cursor-pointer"
              >
                {authLoading ? (
                  <span>Connecting to Google...</span>
                ) : (
                  <>
                    <span>Continue with Google</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="mt-4 text-xs text-slate-400 text-center">
                Camera and microphone access is requested only when you start or join a call.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-4 text-xs text-slate-400 flex items-center justify-between border-t border-white/5">
        <span>PulseCall</span>
        <span>WebRTC · iOS Safari &amp; Android Chrome</span>
      </footer>
    </div>
  );
};
