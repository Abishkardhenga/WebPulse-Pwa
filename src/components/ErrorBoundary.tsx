import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let displayMessage = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string };
      if (parsed.error) {
        displayMessage = parsed.error;
      }
    } catch {
      // Non-JSON error message
    }
    return { hasError: true, message: displayMessage };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('PulseCall ErrorBoundary caught:', error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-[100dvh] bg-[#09152B] text-slate-100 flex items-center justify-center p-6 safe-pt safe-pb safe-px">
        <div className="w-full max-w-md rounded-3xl bg-[#0F1F3D] border border-white/10 p-6 sm:p-8 shadow-2xl">
          <div className="h-12 w-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mb-5">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed break-words">
            {this.state.message}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 w-full min-h-[48px] rounded-2xl bg-[#00E5FF] text-[#09152B] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#33ECFF] active:scale-[0.98] transition"
          >
            <RotateCcw className="w-4 h-4" />
            Reload PulseCall
          </button>
        </div>
      </div>
    );
  }
}
