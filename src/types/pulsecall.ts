import type { Timestamp } from 'firebase/firestore';

export type RoomStatus = 'waiting' | 'active' | 'ended';
export type CallRole = 'host' | 'guest';
export type CallHistoryStatus = 'ongoing' | 'completed' | 'cancelled';
export type CameraFacingMode = 'user' | 'environment';
export type FriendRequestStatus = 'pending' | 'accepted' | 'dismissed';
export type IncomingCallStatus = 'ringing' | 'accepted' | 'declined' | 'cancelled';

export type ConnectionStateLabel =
  | 'initializing'
  | 'waiting'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'ended';

export interface SdpPayload {
  type: 'offer' | 'answer';
  sdp: string;
}

export interface UserProfile {
  uid: string;
  username?: string;
  displayName: string;
  email: string;
  photoURL: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PublicHandle {
  username: string;
  uid: string;
  displayName: string;
  photoURL: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ContactItem {
  ownerUid: string;
  contactUid: string;
  username: string;
  displayName: string;
  photoURL: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface FriendRequestItem {
  targetUid: string;
  senderUid: string;
  senderUsername: string;
  senderName: string;
  senderPhotoUrl: string;
  status: FriendRequestStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface IncomingCallItem {
  roomCode: string;
  callerUid: string;
  callerUsername: string;
  callerName: string;
  callerPhotoUrl: string;
  calleeUid: string;
  status: IncomingCallStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CallRoom {
  code: string;
  hostUid: string;
  hostUsername?: string;
  hostName: string;
  hostPhotoUrl: string;
  calleeUid?: string;
  guestUid?: string;
  guestName?: string;
  guestPhotoUrl?: string;
  status: RoomStatus;
  offer: SdpPayload;
  answer?: SdpPayload;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  endedAt?: Timestamp;
}

export interface IceCandidateDoc {
  senderUid: string;
  candidate: string;
  sdpMid: string;
  sdpMLineIndex: number;
  createdAt?: Timestamp;
}

export interface CallHistoryItem {
  id: string;
  ownerUid: string;
  roomCode: string;
  role: CallRole;
  peerUid?: string;
  peerUsername?: string;
  peerName: string;
  peerPhotoUrl: string;
  status: CallHistoryStatus;
  durationSeconds: number;
  startedAt?: Timestamp;
  updatedAt?: Timestamp;
  endedAt?: Timestamp;
}
