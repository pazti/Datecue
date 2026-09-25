# Together

Together is a polished frontend prototype for private watch parties. It gives two people a shared cinema for synchronized video, timestamped chat, and lightweight reactions.

This repository currently contains the complete frontend experience. The product is intentionally ready for a backend connection later; demo state is local to the browser session and no backend services are included.

## Run locally

```bash
pnpm install
pnpm dev
```

The Vite server runs on `http://localhost:5000`.

For a production build:

```bash
pnpm build
pnpm preview
```

## Frontend surface

- **Landing page** — product introduction, watch preview, feature story, and primary room CTA.
- **Create / join room** — a clear two-mode flow for pasting a video URL or entering a room code.
- **Watch room** — cinematic player surface, playback controls, sync state, participant list, room invite action, live chat, timestamps, and reactions.
- **Theme toggle** — light and dark presentation modes are available across all screens.

## Backend handoff

The UI currently uses local mock state so the full product flow can be demonstrated without a server. The places that should connect to a backend are documented in [`replit.md`](./replit.md).

Recommended backend responsibilities:

1. Create a room and return a durable room code.
2. Validate and persist the video source.
3. Broadcast playback state (`play`, `pause`, `seek`, and current time) to connected participants.
4. Broadcast presence, chat messages, reactions, and typing state.
5. Replace the demo values in `src/pages/WatchRoom.tsx` with API/WebSocket data while preserving the existing UI states.

## Project structure

```text
src/
  components/Logo.tsx       # Together mark and shared line icons
  pages/LandingPage.tsx     # Marketing / entry experience
  pages/CreateRoom.tsx      # Create and join flow
  pages/WatchRoom.tsx       # Watch party experience
  App.tsx                   # Screen-level navigation and theme state
  index.css                 # Shared design tokens and global styles
```

## Design direction

The visual system is cinematic editorial intimacy: warm ivory, coral, navy, and moss; Fraunces for display moments; DM Sans for interface copy; and Space Mono for room metadata. The logo is implemented as a reusable React component in `src/components/Logo.tsx`.

## GitHub

To publish this project to your GitHub repository:

```bash
git add .
git commit -m "Build Together watch party frontend"
git remote add origin https://github.com/<your-account>/<your-repository>.git
git push -u origin main
```

The repository does not include a GitHub remote or credentials, so the final push must be performed against your own repository.