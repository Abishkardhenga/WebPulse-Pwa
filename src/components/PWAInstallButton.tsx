import React, { useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="min-h-[44px] px-4 py-2 rounded-xl bg-[#00E5FF]/15 border border-[#00E5FF]/40 text-[#00E5FF] text-xs sm:text-sm font-semibold flex items-center gap-2 hover:bg-[#00E5FF]/25 active:scale-[0.98] transition whitespace-nowrap shrink-0"
      >
        <Download className="w-4 h-4" />
        Install App
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0F1F3D] border border-white/15 text-slate-200 text-xs sm:text-sm font-medium flex items-center gap-2 hover:border-[#00E5FF]/40 hover:text-white active:scale-[0.98] transition whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4 text-[#00E5FF]" />
          Add to Home
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#040A17]/80 backdrop-blur-sm p-4 safe-pb"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-sm rounded-3xl bg-[#0F1F3D] border border-white/15 p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="ios-install-title" className="text-lg font-bold text-white">
                    Install PulseCall on iOS
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Launch full-screen directly from your iPhone or iPad Home Screen.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install guide"
                  className="min-h-[44px] min-w-[44px] -mt-2 -mr-2 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <ol className="mt-5 space-y-4 text-sm text-slate-200">
                <li className="flex items-center gap-3">
                  <span className="h-9 w-9 shrink-0 rounded-xl bg-[#00E5FF]/15 text-[#00E5FF] flex items-center justify-center">
                    <Share className="w-4 h-4" />
                  </span>
                  <span>
                    Tap the <strong className="text-white">Share</strong> button in Safari&apos;s
                    toolbar.
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="h-9 w-9 shrink-0 rounded-xl bg-[#00E5FF]/15 text-[#00E5FF] flex items-center justify-center">
                    <PlusSquare className="w-4 h-4" />
                  </span>
                  <span>
                    Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.
                  </span>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full min-h-[48px] rounded-2xl bg-[#00E5FF] text-[#09152B] font-semibold text-sm hover:bg-[#33ECFF] active:scale-[0.98] transition"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
