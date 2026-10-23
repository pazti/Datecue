# Datecue

Datecue is a private watch-party app built with React, Vite, and Firebase.

**Same movie. Same second. Same reactions.**

It gives two people a shared cinema for synchronized video, timestamped chat, and lightweight reactions.

Authenticated users can create and join rooms backed by Firebase Realtime Database. Rooms support synchronized YouTube playback, live presence, chat, reactions, and saved watch history.

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
- **Create / join room** — a two-mode flow for pasting a YouTube URL or entering a room code. Invite links preserve the room code through sign-in.
- **Watch room** — synchronized playback, live presence, chat, timestamps, and reactions.
- **Home** — saved rooms, total watch time, and manageable notifications.
- **Theme toggle** — light and dark presentation modes are available across all screens.

## Firebase setup

Firebase web configuration is read from `VITE_FIREBASE_*` environment variables. The repository includes fallback values for the Firebase project used by the original import; set all configuration values for your own Firebase project before deploying a fork.

Enable Email/Password authentication and Realtime Database in that Firebase project. Room access rules are in [`database.rules.json`](./database.rules.json), referenced by [`firebase.json`](./firebase.json). Deploy those rules before testing room playback, presence, chat, and reactions:

```bash
firebase deploy --only database
```

The Firebase CLI must be authenticated and pointed at the intended project. The Firebase web API key is client configuration, not a server secret; restrict it in Firebase/Google Cloud settings as appropriate.

## Project structure

```text
src/
  components/Logo.tsx       # Datecue mark and shared line icons
  pages/LandingPage.tsx     # Marketing / entry experience
  pages/CreateRoom.tsx      # Create and join flow
  pages/WatchRoom.tsx       # Watch party experience
  App.tsx                   # Screen-level navigation and theme state
  index.css                 # Shared design tokens and global styles
```

## Design direction

The visual system is cinematic editorial intimacy: warm ivory, coral, navy, and moss; Fraunces for display moments; DM Sans for interface copy; and Space Mono for room metadata. The Datecue logo is implemented as a reusable React component in `src/components/Logo.tsx`.

## GitHub

To publish this project to your GitHub repository:

```bash
git add .
git commit -m "Build Datecue watch party frontend"
git remote add origin https://github.com/<your-account>/<your-repository>.git
git push -u origin main
```

The repository does not include a GitHub remote or credentials, so the final push must be performed against your own repository.