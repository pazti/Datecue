# Datecue

Datecue is a React + Vite watch-party app using Firebase Authentication and Realtime Database.

## Run and build

```bash
pnpm install
pnpm dev
pnpm build
pnpm exec tsc --noEmit
```

The Replit preview runs Vite on `0.0.0.0:5000`.

## Firebase setup

- Configure a Firebase Web app using the `VITE_FIREBASE_*` environment variables.
- Email/Password authentication and Realtime Database must be enabled.
- `database.rules.json` contains the membership, room, chat, reaction, playback, and user-data rules. Deploy it to the Firebase project before testing shared rooms.
- The Firebase web config is public client configuration; never put service-account credentials in client code.

## Product behavior

- App navigation and invite links use URL hashes, so room invites work without server-side rewrite rules.
- Room playback is controlled by the room host; other active participants follow its play, pause, and seek state.
- Room membership is limited to two active participants using presence-aware database rules.
- Watch time and room history are saved when a participant leaves the room.
- The decorative hero is CSS-based and does not require WebGL. Keep reduced-motion preferences respected.

## Project conventions

- Keep shared visual tokens in `src/index.css` and common icons in `src/components/Logo.tsx`.
- Firebase access helpers live in `src/lib/`; pages own their UI and subscriptions.
- Preserve visible error feedback, keyboard focus indicators, and responsive layouts.
