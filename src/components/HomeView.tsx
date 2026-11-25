import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Search,
  UserPlus,
  UserCheck,
  Video,
  Link2,
  PhoneIncoming,
  PhoneOutgoing,
  Trash2,
  LogOut,
  Clock,
  X,
  Users,
  Check,
} from 'lucide-react';
import type { CallTargetPeer } from '../hooks/useWebRTCCall';
import type {
  CallHistoryItem,
  ContactItem,
  FriendRequestItem,
  PublicHandle,
  UserProfile,
} from '../types/pulsecall';
import { PWAInstallButton } from './PWAInstallButton';

interface HomeViewProps {
  user: User;
  userProfile: UserProfile;
  pendingRoomCode: string | null;
  onDismissPendingRoom: () => void;
  contacts: ContactItem[];
  contactsLoading: boolean;
  friendRequests: FriendRequestItem[];
  searchResults: PublicHandle[];
  searchLoading: boolean;
  calls: CallHistoryItem[];
  callsLoading: boolean;
  isStartingCall: boolean;
  callError: string | null;
  onClearError: () => void;
  onSearchPeople: (query: string) => void;
  onAddFriend: (target: PublicHandle) => Promise<void>;
  onAcceptFriendRequest: (req: FriendRequestItem) => Promise<void>;
  onDismissFriendRequest: (senderUid: string) => Promise<void>;
  onRemoveContact: (contactUid: string) => Promise<void>;
  onCallFriend: (peer: CallTargetPeer) => void;
  onStartLinkCall: () => void;
  onJoinCallByLink: (roomCode: string) => void;
  onDeleteHistoryItem: (callId: string) => void;
  onSignOut: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatCallDate(item: CallHistoryItem): string {
  if (!item.startedAt) return 'Just now';
  const date = item.startedAt.toDate();
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (parts[0]?.[0] ?? 'P').toUpperCase();
}

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  userProfile,
  pendingRoomCode,
  onDismissPendingRoom,
  contacts,
  contactsLoading,
  friendRequests,
  searchResults,
  searchLoading,
  calls,
  callsLoading,
  isStartingCall,
  callError,
  onClearError,
  onSearchPeople,
  onAddFriend,
  onAcceptFriendRequest,
  onDismissFriendRequest,
  onRemoveContact,
  onCallFriend,
  onStartLinkCall,
  onJoinCallByLink,
  onDeleteHistoryItem,
  onSignOut,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [addingUid, setAddingUid] = useState<string | null>(null);
  const [copiedHandle, setCopiedHandle] = useState(false);

  const contactUids = new Set(contacts.map((c) => c.contactUid));

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearchPeople(value);
  };

  const handleAddClick = async (person: PublicHandle) => {
    setAddingUid(person.uid);
    try {
      await onAddFriend(person);
    } finally {
      setAddingUid(null);
    }
  };

  const handleCopyUsername = async () => {
    const handleText = userProfile.username ? `@${userProfile.username}` : userProfile.displayName;
    try {
      await navigator.clipboard.writeText(handleText);
      setCopiedHandle(true);
      window.setTimeout(() => setCopiedHandle(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#09152B] text-slate-100 flex flex-col safe-pt safe-pb safe-px">
      {/* Top Bar */}
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 border-b border-white/10">
        <div className="flex items-center gap-3 shrink-0">
          <img
            src="/icon.svg"
            alt="PulseCall"
            referrerPolicy="no-referrer"
            className="h-9 w-9 rounded-xl"
          />
          <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap">
            PulseCall
          </span>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <PWAInstallButton />

          <div className="flex items-center gap-2.5 pl-2 border-l border-white/10">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={userProfile.displayName}
                referrerPolicy="no-referrer"
                className="h-9 w-9 rounded-full object-cover border border-white/15"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-[#13264A] border border-white/15 flex items-center justify-center text-xs font-bold text-[#00E5FF]">
                {getInitials(userProfile.displayName)}
              </div>
            )}
            <div className="hidden sm:block text-left leading-tight">
              <p className="text-sm font-semibold text-white max-w-[130px] truncate">
                {userProfile.displayName}
              </p>
              {userProfile.username && (
                <p className="text-xs font-mono text-[#00E5FF]">@{userProfile.username}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 space-y-6">
        {/* Invite link fallback banner (?room=CODE) */}
        {pendingRoomCode && (
          <div className="rounded-3xl bg-[#0F1F3D] border border-[#00E5FF]/45 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
            <div>
              <p className="text-sm font-semibold text-[#00E5FF]">Call invite link ready</p>
              <h2 className="mt-1 text-xl font-bold text-white">
                Ready to join video call
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Tap below to allow camera &amp; microphone and connect.
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => onJoinCallByLink(pendingRoomCode)}
                disabled={isStartingCall}
                className="min-h-[48px] px-5 rounded-2xl bg-[#00E5FF] text-[#09152B] font-bold text-sm flex items-center gap-2 hover:bg-[#33ECFF] active:scale-[0.98] disabled:opacity-60 transition cursor-pointer whitespace-nowrap"
              >
                <Video className="w-4 h-4" />
                <span>{isStartingCall ? 'Joining...' : 'Join Call'}</span>
              </button>
              <button
                type="button"
                onClick={onDismissPendingRoom}
                aria-label="Dismiss invitation"
                className="min-h-[48px] min-w-[48px] rounded-2xl bg-white/5 border border-white/10 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Friend Requests ("Added you") */}
        {friendRequests.length > 0 && (
          <section className="rounded-3xl bg-[#0F1F3D] border border-[#00E5FF]/35 p-5 shadow-xl">
            <h2 className="text-sm font-bold text-[#00E5FF]">Added you on PulseCall</h2>
            <ul className="mt-3 divide-y divide-white/10">
              {friendRequests.map((req) => (
                <li
                  key={req.senderUid}
                  className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {req.senderPhotoUrl ? (
                      <img
                        src={req.senderPhotoUrl}
                        alt={req.senderName}
                        referrerPolicy="no-referrer"
                        className="h-10 w-10 rounded-full object-cover border border-white/15 shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-[#13264A] border border-white/15 flex items-center justify-center text-xs font-bold text-[#00E5FF] shrink-0">
                        {getInitials(req.senderName)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{req.senderName}</p>
                      <p className="text-xs font-mono text-slate-300 truncate">
                        @{req.senderUsername}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void onAcceptFriendRequest(req)}
                      className="min-h-[44px] px-4 rounded-xl bg-[#00E5FF] text-[#09152B] text-xs font-bold hover:bg-[#33ECFF] transition cursor-pointer whitespace-nowrap"
                    >
                      Add Back
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDismissFriendRequest(req.senderUid)}
                      aria-label={`Dismiss request from ${req.senderName}`}
                      className="min-h-[44px] min-w-[44px] rounded-xl bg-white/5 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {callError && (
          <div
            role="alert"
            className="rounded-2xl bg-red-500/15 border border-red-500/35 p-4 flex items-start justify-between gap-3 text-sm text-red-100"
          >
            <p className="leading-relaxed">{callError}</p>
            <button
              type="button"
              onClick={onClearError}
              aria-label="Dismiss error"
              className="min-h-[36px] min-w-[36px] -mt-1 -mr-1 rounded-lg flex items-center justify-center text-red-200 hover:bg-red-500/20 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Search & Add People + Friends List */}
          <div className="lg:col-span-7 space-y-6">
            {/* Search & Add People */}
            <section className="rounded-3xl bg-[#0F1F3D] border border-white/10 p-6 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    Find &amp; add friends
                  </h1>
                  <p className="mt-1 text-sm text-slate-300">
                    Search anyone by their unique @username to add and video call.
                  </p>
                </div>
              </div>

              <div className="mt-4 relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search @username..."
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label="Search by username"
                  className="w-full min-h-[48px] rounded-2xl bg-[#09152B] border border-white/15 pl-11 pr-11 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00E5FF] transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => handleSearchChange('')}
                    aria-label="Clear search"
                    className="min-h-[40px] min-w-[40px] absolute right-1.5 rounded-xl flex items-center justify-center text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="mt-4">
                {searchLoading ? (
                  <div className="space-y-2.5">
                    {[0, 1].map((i) => (
                      <div
                        key={i}
                        className="h-14 rounded-2xl bg-[#09152B]/60 border border-white/5 animate-pulse"
                      />
                    ))}
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className="py-4 text-sm text-slate-400 text-center">
                    {searchQuery
                      ? `No users found matching @${searchQuery.replace(/^@+/, '')}.`
                      : 'Invite friends to sign up and claim their @username to appear here.'}
                  </p>
                ) : (
                  <ul className="divide-y divide-white/10">
                    {searchResults.map((person) => {
                      const isAdded = contactUids.has(person.uid);
                      return (
                        <li
                          key={person.uid}
                          className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {person.photoURL ? (
                              <img
                                src={person.photoURL}
                                alt={person.displayName}
                                referrerPolicy="no-referrer"
                                className="h-10 w-10 rounded-full object-cover border border-white/15 shrink-0"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-[#13264A] border border-white/15 flex items-center justify-center text-xs font-bold text-[#00E5FF] shrink-0">
                                {getInitials(person.displayName)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white truncate">
                                {person.displayName}
                              </p>
                              <p className="text-xs font-mono text-slate-400 truncate">
                                @{person.username}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isAdded ? (
                              <>
                                <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-emerald-400 pr-1">
                                  <UserCheck className="w-3.5 h-3.5" />
                                  Added
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onCallFriend({
                                      uid: person.uid,
                                      username: person.username,
                                      displayName: person.displayName,
                                      photoURL: person.photoURL,
                                    })
                                  }
                                  disabled={isStartingCall}
                                  className="min-h-[44px] px-4 rounded-xl bg-[#00E5FF] text-[#09152B] text-xs font-bold flex items-center gap-1.5 hover:bg-[#33ECFF] active:scale-[0.98] disabled:opacity-60 transition cursor-pointer whitespace-nowrap"
                                >
                                  <Video className="w-3.5 h-3.5" />
                                  <span>Call</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void handleAddClick(person)}
                                disabled={addingUid === person.uid}
                                className="min-h-[44px] px-4 rounded-xl bg-white/10 border border-white/15 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-[#00E5FF] hover:text-[#09152B] hover:border-[#00E5FF] active:scale-[0.98] disabled:opacity-60 transition cursor-pointer whitespace-nowrap"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>{addingUid === person.uid ? 'Adding...' : 'Add'}</span>
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>

            {/* Your Added Friends List */}
            <section className="rounded-3xl bg-[#0F1F3D] border border-white/10 p-6 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-white">Your friends</h2>
                <span className="text-xs text-slate-400 tabular-nums">
                  {contactsLoading ? 'Loading' : `${contacts.length} added`}
                </span>
              </div>

              {contactsLoading ? (
                <div className="mt-4 space-y-3">
                  {[0, 1].map((i) => (
                    <div
                      key={i}
                      className="h-16 rounded-2xl bg-[#09152B]/60 border border-white/5 animate-pulse"
                    />
                  ))}
                </div>
              ) : contacts.length === 0 ? (
                <div className="mt-4 rounded-2xl bg-[#09152B]/60 border border-white/5 p-6 text-center">
                  <Users className="w-6 h-6 text-slate-400 mx-auto mb-2.5" />
                  <p className="text-sm font-medium text-slate-200">No friends added yet</p>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Search a friend&apos;s @username above and tap Add to call them with one tap.
                  </p>
                </div>
              ) : (
                <ul className="mt-4 divide-y divide-white/10">
                  {contacts.map((friend) => (
                    <li
                      key={friend.contactUid}
                      className="py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {friend.photoURL ? (
                          <img
                            src={friend.photoURL}
                            alt={friend.displayName}
                            referrerPolicy="no-referrer"
                            className="h-11 w-11 rounded-full object-cover border border-white/15 shrink-0"
                          />
                        ) : (
                          <div className="h-11 w-11 rounded-full bg-[#13264A] border border-white/15 flex items-center justify-center text-sm font-bold text-[#00E5FF] shrink-0">
                            {getInitials(friend.displayName)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {friend.displayName}
                          </p>
                          <p className="text-xs font-mono text-slate-400 truncate">
                            @{friend.username}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onCallFriend({
                              uid: friend.contactUid,
                              username: friend.username,
                              displayName: friend.displayName,
                              photoURL: friend.photoURL,
                            })
                          }
                          disabled={isStartingCall}
                          className="min-h-[44px] px-4 rounded-xl bg-[#00E5FF] text-[#09152B] text-xs font-bold flex items-center gap-1.5 hover:bg-[#33ECFF] active:scale-[0.98] disabled:opacity-60 transition cursor-pointer whitespace-nowrap"
                        >
                          <Video className="w-4 h-4" />
                          <span>{isStartingCall ? 'Calling...' : 'Video Call'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => void onRemoveContact(friend.contactUid)}
                          aria-label={`Remove ${friend.displayName} from friends`}
                          className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Right Column: Your Handle Card + Recent Calls */}
          <div className="lg:col-span-5 space-y-6">
            <section className="rounded-3xl bg-[#0F1F3D] border border-white/10 p-6 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Your unique handle</p>
                  <p className="mt-0.5 font-mono text-lg font-bold text-[#00E5FF] truncate">
                    @{userProfile.username ?? 'user'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyUsername()}
                  className="min-h-[44px] px-3.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5 transition cursor-pointer shrink-0"
                >
                  {copiedHandle ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <span>Copy Handle</span>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={onStartLinkCall}
                disabled={isStartingCall}
                className="mt-4 w-full min-h-[48px] rounded-2xl bg-white/5 border border-white/15 text-sm font-semibold text-slate-100 hover:bg-white/10 hover:border-[#00E5FF]/40 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
              >
                <Link2 className="w-4 h-4 text-[#00E5FF]" />
                <span>Start Shareable Link Call</span>
              </button>
            </section>

            <section className="rounded-3xl bg-[#0F1F3D] border border-white/10 p-6 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-white">Recent calls</h2>
                <span className="text-xs text-slate-400 tabular-nums">
                  {callsLoading ? 'Loading' : `${calls.length} recorded`}
                </span>
              </div>

              {callsLoading ? (
                <div className="mt-4 space-y-3">
                  {[0, 1, 2].map((skeleton) => (
                    <div
                      key={skeleton}
                      className="h-16 rounded-2xl bg-[#09152B]/70 border border-white/5 animate-pulse"
                    />
                  ))}
                </div>
              ) : calls.length === 0 ? (
                <div className="mt-4 rounded-2xl bg-[#09152B]/60 border border-white/5 p-6 text-center">
                  <Clock className="w-6 h-6 text-slate-400 mx-auto mb-2.5" />
                  <p className="text-sm font-medium text-slate-200">No calls yet</p>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Calls with your friends will appear here automatically.
                  </p>
                </div>
              ) : (
                <ul className="mt-4 divide-y divide-white/10">
                  {calls.map((item) => (
                    <li key={item.id} className="py-3.5 first:pt-1 last:pb-1 flex items-center gap-3">
                      {item.peerPhotoUrl ? (
                        <img
                          src={item.peerPhotoUrl}
                          alt={item.peerName}
                          referrerPolicy="no-referrer"
                          className="h-10 w-10 rounded-full object-cover border border-white/10 shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-[#13264A] border border-white/10 flex items-center justify-center text-xs font-bold text-[#00E5FF] shrink-0">
                          {getInitials(item.peerName)}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {item.role === 'host' ? (
                            <PhoneOutgoing className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
                          ) : (
                            <PhoneIncoming className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          )}
                          <p className="text-sm font-semibold text-white truncate">
                            {item.peerName}
                          </p>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400 truncate tabular-nums">
                          {item.peerUsername && (
                            <>
                              <span className="font-mono text-slate-300">
                                @{item.peerUsername}
                              </span>
                              <span aria-hidden="true"> · </span>
                            </>
                          )}
                          <span>
                            {item.status === 'completed'
                              ? formatDuration(item.durationSeconds)
                              : item.status === 'ongoing'
                                ? 'In progress'
                                : 'No answer'}
                          </span>
                          <span aria-hidden="true"> · </span>
                          <span>{formatCallDate(item)}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {item.peerUid && (
                          <button
                            type="button"
                            onClick={() =>
                              onCallFriend({
                                uid: item.peerUid!,
                                username: item.peerUsername,
                                displayName: item.peerName,
                                photoURL: item.peerPhotoUrl,
                              })
                            }
                            disabled={isStartingCall}
                            aria-label={`Call ${item.peerName} back`}
                            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-[#00E5FF] hover:bg-[#00E5FF]/15 transition cursor-pointer"
                          >
                            <Video className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteHistoryItem(item.id)}
                          aria-label={`Remove call with ${item.peerName} from history`}
                          className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};
