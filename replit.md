# Together frontend handoff

## Current scope

Together is a frontend-only watch-party experience. The screens and interactions are intentionally usable with local demo state while the backend is being built separately.

The current workflow is:

```bash
pnpm dev
```

Vite is configured to bind to `0.0.0.0` and port `5000` for Replit preview compatibility.

## Backend integration points

The backend can be connected without restructuring the UI:

- `src/App.tsx`
  - Replace screen-level callbacks with route handling when durable URLs are introduced.
  - Pass room and participant data down from the backend-backed session.
- `src/pages/CreateRoom.tsx`
  - `handleSubmit` is the create/join boundary.
  - Create mode should submit a YouTube URL and nickname.
  - Join mode should submit a six-character room code and nickname.
  - On success, navigate to the room using the returned room identifier.
- `src/pages/WatchRoom.tsx`
  - `INIT_MSGS`, `ROOM_CODE`, and the participant data are demo values.
  - Replace local message state with the room message stream.
  - Replace the timer-driven playback state with the authoritative server playback state.
  - Replace `copyLink`'s hardcoded URL with the deployed room URL.
  - Wire chat send, reaction send, playback changes, presence, typing, and room leave to the backend.

## Suggested API contract

These are frontend expectations, not an imposed backend implementation:

```text
POST /api/rooms
  body: { videoUrl, nickname }
  returns: { roomCode, roomUrl, sessionId }

POST /api/rooms/:roomCode/join
  body: { nickname }
  returns: { roomCode, sessionId, room }

GET /api/rooms/:roomCode
  returns: { roomCode, video, participants, playback, messages }

WebSocket /api/rooms/:roomCode/live
  events: playback, chat, reaction, presence, typing
```

Playback events should include an event timestamp and the current video time so clients can correct drift. The UI already exposes a synced / out-of-sync state that can be driven by that comparison.

## UI conventions

- Keep the Together logo in `src/components/Logo.tsx` rather than recreating it per page.
- Use the shared color tokens and font classes from `src/index.css`.
- Preserve keyboard focus states, labels, `aria-label`s, and reduced-motion support.
- Keep the primary brand/navigation UI free of emoji dependencies; reactions inside the watch room can remain expressive.
- Prefer relative URLs for same-origin backend calls in Replit and production.

## Verification

```bash
pnpm build
```

There are no backend tests in this frontend-only import yet. Add end-to-end coverage once room creation, joining, and live synchronization have real server behavior.