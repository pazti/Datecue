# Datecue

Datecue is a private watch-party app built with React, Vite, and Firebase.

**Same movie. Same second. Same reactions.**

It gives two people a shared cinema for synchronized video, timestamped chat, and lightweight reactions.

Authenticated users can create and join rooms backed by Firebase Realtime Database. Rooms support synchronized YouTube playback, live presence, chat, reactions, and saved watch history. Privacy Policy and Terms of Service are available from the landing, account, and home screens.

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
- **Profile** — manage your room identity, review private watch history, export account data, or delete your account.
- **Theme toggle** — light and dark presentation modes persist across screens and visits.
- **Browser notifications** — opt-in push alerts for room updates, delivered by Firebase Cloud Messaging.

## Firebase setup

Firebase web configuration is read from `VITE_FIREBASE_*` environment variables. The repository includes fallback values for the Firebase project used by the original import; set all configuration values for your own Firebase project before deploying a fork.

Enable Email/Password and Google authentication, Realtime Database, and Firebase Analytics in that Firebase project. Room access rules are in [`database.rules.json`](./database.rules.json), referenced by [`firebase.json`](./firebase.json). They require verified accounts, permit at most two room members, reject joins to stale or cleanup-pending rooms, and restrict host-only room operations.

The scheduled cleanup function in [`functions/index.js`](./functions/index.js) removes rooms after 48 hours without activity. It runs once daily, so deletion can occur up to roughly 24 hours after the inactivity window. Deploy both rules and functions before testing production behavior:

```bash
firebase deploy --only hosting,database,functions
```

The Firebase CLI must be authenticated and pointed at the intended project. Scheduled functions require the appropriate Firebase billing plan and Cloud Scheduler/Functions APIs. The Firebase web API key is client configuration, not a server secret; restrict it in Firebase/Google Cloud settings as appropriate.

For browser notifications, enable Firebase Cloud Messaging, add the project's web push certificate public key as `VITE_FIREBASE_VAPID_KEY`, and deploy the database rules and `sendBrowserNotification` function. Users must opt in from Home. Account deletion uses the `deleteAccountData` callable function and also requires deployment.

The privacy and terms pages are an implementation draft. Add the service operator's legal name, privacy contact, and applicable jurisdiction before public launch.

## Project structure

```text
src/
  components/Logo.tsx       # Datecue mark and shared line icons
  pages/LandingPage.tsx     # Marketing / entry experience
  pages/LegalPage.tsx       # Privacy Policy and Terms of Service
  pages/CreateRoom.tsx      # Create and join flow
  pages/WatchRoom.tsx       # Watch party experience
  pages/ProfilePage.tsx     # Private profile and account controls
  App.tsx                   # Screen-level navigation and persisted theme state
  index.css                 # Shared design tokens and global styles
functions/
  index.js                  # Room cleanup, account deletion, and push delivery
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