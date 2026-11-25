# PulseCall Firestore Security Specification (Phase 0)

## 1. Data Invariants

1. **PII Isolation**: User profiles (`/users/{userId}`) contain `email` and are strictly owner-only (`get`, `create`, `update`). `list` is forbidden on `/users`.
2. **Call History Ownership**: Call history items (`/users/{userId}/calls/{callId}`) belong exclusively to `userId` (`ownerUid == request.auth.uid`), with `list` constrained to `resource.data.ownerUid == request.auth.uid` and `get()` lookups avoided in `list`.
3. **Room Discovery Protection**: `/rooms/{roomCode}` prohibits `list` queries so attackers cannot enumerate active room codes. `get` is allowed only for verified signed-in users addressing a valid 6-character `[A-Z0-9]{6}` room code.
4. **Immutable Host Identity**: On room creation, `hostUid` must equal `request.auth.uid`, `code` must equal `{roomCode}`, `status` must be `'waiting'`, and `createdAt == request.time`. `hostUid`, `code`, and `createdAt` can never change on update.
5. **Single-Guest Claim & State Progression**: Only a non-host signed-in user may transition a `'waiting'` room to `'active'` by setting `guestUid == request.auth.uid`, `guestName`, `guestPhotoUrl`, `answer`, `status: 'active'`, and `updatedAt: request.time`. Once `guestUid` is set, another third-party user cannot hijack the room.
6. **Terminal State Locking**: Once a room reaches `status == 'ended'`, no further updates are permitted on the room document.
7. **Master Gate on ICE Candidates**: Access to `/rooms/{roomCode}/callerCandidates/{candidateId}` and `/rooms/{roomCode}/calleeCandidates/{candidateId}` is gated via `get()` on the parent `/rooms/{roomCode}` document:
   - Host (`hostUid == request.auth.uid`) can create `callerCandidates` and read both `callerCandidates` and `calleeCandidates`.
   - Guest (`guestUid == request.auth.uid`) can create `calleeCandidates` and read both `callerCandidates` and `calleeCandidates`.
   - Neither party can write candidates after the room `status == 'ended'`.
8. **Temporal Integrity & Verified Email**: All creates require `createdAt == request.time` and updates require `updatedAt == request.time`, and all writes require `request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Attack Payloads (All Must Fail with PERMISSION_DENIED)

1. **Unauthenticated Room Read**: Unauthenticated client attempts `get /rooms/AB12CD`.
2. **Room Enumeration (List Scraping)**: Authenticated user attempts `list /rooms`.
3. **Profile PII Leak**: Authenticated User B attempts `get /users/{userA_uid}`.
4. **Shadow Field Injection on User Create**: User A attempts `create /users/{userA_uid}` with extra field `isAdmin: true`.
5. **Host Identity Spoofing**: User B attempts `create /rooms/XY89ZW` with `hostUid: userA_uid`.
6. **Invalid Room Code Poisoning**: User A attempts `create /rooms/invalid-1500-byte-id` or lowercase `'abc123'`.
7. **Client Timestamp Forgery**: User A attempts `create /rooms/AB12CD` with backdated `createdAt`.
8. **Room Hijacking**: User C attempts `update /rooms/AB12CD` when `status == 'active'` and `guestUid == userB_uid`.
9. **Post-Terminal Mutation**: Host attempts `update /rooms/AB12CD` to change `status` back to `'active'` after `status == 'ended'`.
10. **Third-Party ICE Candidate Injection**: User C (neither host nor guest) attempts `create /rooms/AB12CD/calleeCandidates/cand1`.
11. **Oversized SDP Payload**: User A attempts `create /rooms/AB12CD` with a 100KB `offer.sdp` string.
12. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts `create /users/{uid}/calls/c1`.
