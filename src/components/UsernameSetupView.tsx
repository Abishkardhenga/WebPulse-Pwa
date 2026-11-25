import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { AtSign, CheckCircle2, XCircle, Loader2, ArrowRight, LogOut } from 'lucide-react';
import { normalizeUsername, USERNAME_REGEX } from '../lib/firebase';

interface UsernameSetupViewProps {
  user: User;
  checkUsernameAvailability: (handle: string) => Promise<boolean>;
  claimUsername: (handle: string, displayName: string) => Promise<void>;
  onSignOut: () => void;
}

export const UsernameSetupView: React.FC<UsernameSetupViewProps> = ({
  user,
  checkUsernameAvailability,
  claimUsername,
  onSignOut,
}) => {
  const [displayName, setDisplayName] = useState<string>(user.displayName ?? '');
  const [username, setUsername] = useState<string>(() => {
    const seed = user.displayName || user.email?.split('@')[0] || 'pulsecall_user';
    const cleaned = normalizeUsername(seed.replace(/\s+/g, '_'));
    return cleaned.length >= 3 ? cleaned : `${cleaned}123`.slice(0, 12);
  });
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>(
    'idle'
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const clean = normalizeUsername(username);
    if (!clean || clean.length < 3 || !USERNAME_REGEX.test(clean)) {
      setStatus('invalid');
      return;
    }

    let cancelled = false;
    setStatus('checking');
    const timer = window.setTimeout(() => {
      void checkUsernameAvailability(clean)
        .then((isFree) => {
          if (!cancelled) {
            setStatus(isFree ? 'available' : 'taken');
          }
        })
        .catch(() => {
          if (!cancelled) {
            setStatus('idle');
          }
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [username, checkUsernameAvailability]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeUsername(username);
    if (!USERNAME_REGEX.test(clean)) {
      setError('Choose 3–24 characters using lowercase letters, numbers, or underscores.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await claimUsername(clean, displayName.trim() || user.displayName || clean);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to claim username.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#09152B] text-slate-100 flex flex-col justify-between safe-pt safe-pb safe-px">
      <header className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src="/icon.svg"
            alt="PulseCall"
            referrerPolicy="no-referrer"
            className="h-9 w-9 rounded-xl"
          />
          <span className="font-display text-xl font-bold text-white tracking-tight">
            PulseCall
          </span>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="min-h-[44px] px-3 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 flex items-center gap-2 transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Switch account</span>
        </button>
      </header>

      <main className="w-full max-w-lg mx-auto px-4 sm:px-6 py-6 flex-1 flex items-center">
        <div className="w-full rounded-3xl bg-[#0F1F3D] border border-white/10 p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-3.5 mb-5">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName ?? 'Profile'}
                referrerPolicy="no-referrer"
                className="h-12 w-12 rounded-full object-cover border border-white/15"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-[#13264A] border border-white/15 flex items-center justify-center text-base font-bold text-[#00E5FF]">
                {(user.displayName?.[0] ?? 'P').toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Pick your unique username
              </h1>
              <p className="text-sm text-slate-300 truncate">
                Friends will search and add you with this handle.
              </p>
            </div>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label htmlFor="display-name" className="block text-xs font-medium text-slate-300 mb-1.5">
                Display name
              </label>
              <input
                id="display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={100}
                placeholder="Your full name"
                className="w-full min-h-[48px] rounded-2xl bg-[#09152B] border border-white/15 px-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00E5FF] transition"
              />
            </div>

            <div>
              <label htmlFor="unique-username" className="block text-xs font-medium text-slate-300 mb-1.5">
                Unique username
              </label>
              <div className="relative flex items-center">
                <AtSign className="w-4 h-4 text-[#00E5FF] absolute left-4 pointer-events-none" />
                <input
                  id="unique-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                  maxLength={24}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="your_handle"
                  className="w-full min-h-[52px] rounded-2xl bg-[#09152B] border border-white/15 pl-10 pr-11 font-mono text-base font-semibold text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00E5FF] transition"
                />
                <div className="absolute right-3.5 flex items-center">
                  {status === 'checking' && (
                    <Loader2 className="w-4 h-4 text-[#00E5FF] animate-spin" />
                  )}
                  {status === 'available' && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  )}
                  {status === 'taken' && <XCircle className="w-5 h-5 text-red-400" />}
                </div>
              </div>

              <p className="mt-2 text-xs">
                {status === 'invalid' && (
                  <span className="text-slate-400">
                    Use 3–24 lowercase letters, numbers, or underscores.
                  </span>
                )}
                {status === 'checking' && (
                  <span className="text-slate-300">Checking availability...</span>
                )}
                {status === 'available' && (
                  <span className="text-emerald-400 font-medium">
                    @{username} is available
                  </span>
                )}
                {status === 'taken' && (
                  <span className="text-red-400 font-medium">
                    @{username} is already taken. Try another name.
                  </span>
                )}
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-2xl bg-red-500/15 border border-red-500/35 p-3.5 text-sm text-red-200"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || status === 'taken' || status === 'invalid'}
              className="mt-2 w-full min-h-[52px] rounded-2xl bg-[#00E5FF] text-[#09152B] font-bold text-sm sm:text-base flex items-center justify-center gap-2 hover:bg-[#33ECFF] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <span>{submitting ? 'Saving profile...' : 'Continue to PulseCall'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>

      <footer className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-4 text-xs text-slate-500 text-center">
        PulseCall · Unique @username handles
      </footer>
    </div>
  );
};
