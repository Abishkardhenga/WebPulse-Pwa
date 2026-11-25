import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-6 sm:w-auto z-50 flex items-center justify-center gap-2 rounded-2xl bg-amber-500/95 px-4 py-3 text-xs font-semibold text-[#09152B] shadow-xl safe-pb"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Offline — Reconnect to place or join video calls.</span>
    </div>
  );
};
