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

## Automated checks

The GitHub Actions workflow in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) runs on pushes to `main`/`master` and on pull requests. It installs the locked frontend dependencies, runs TypeScript checks and a production build, then installs, audits, and syntax-checks the Cloud Functions. Configure branch protection in GitHub if these checks should be required before merging.

## Frontend surface

- **Landing page** — product introduction, watch preview, feature story, and primary room CTA.
- **Create / join room** — a two-mode flow for pasting a YouTube URL or entering a room code. Invite links preserve the room code through sign-in.
- **Watch room** — synchronized playback, live presence, chat, timestamps, and reactions.
- **Shared watch queue** — both participants can add videos; the host chooses which queued video plays next.
- **Room controls and profiles** — hosts can pause chat, reactions, or guest queue suggestions; participants can view each other's room profile.
- **Scheduling and resume** — schedule a room with an in-app reminder, and resume a previous room from its saved playback checkpoint.
- **Watch recaps** — review private summaries of videos watched, time spent, participants, and selected timestamped chat highlights.
- **Home** — saved rooms, total watch time, upcoming rooms, recaps, and manageable notifications.
- **Profile** — manage your room identity and accessibility preferences, review private watch history, export account data, or delete your account.
- **Theme toggle** — light and dark presentation modes persist across screens and visits.
- **Browser notifications** — opt-in push alerts for room updates, delivered by Firebase Cloud Messaging.

## Firebase setup

Firebase web configuration is read from `VITE_FIREBASE_*` environment variables. Copy [`.env.example`](./.env.example) to `.env` for local development. The example contains the original project's client configuration (not server credentials); replace it with your own project's values before deploying a fork.

On Vercel, use the Vite preset, `pnpm install --frozen-lockfile`, `pnpm build`, and `dist` as the output directory. [`vercel.json`](./vercel.json) rewrites direct page requests to the SPA entry point so paths such as `/privacy` and `/terms` work on refresh. Add the complete Firebase web configuration to the project's Environment Variables for every deployment environment you use. `VITE_FIREBASE_MEASUREMENT_ID` is optional; without it, Analytics is disabled. A deployment with no custom Firebase variables uses the original Datecue Firebase project. If you configure a custom project, the build checks that all required Firebase variables are present and fails with the missing names instead of deploying a blank page.

Enable Email/Password and Google authentication and Realtime Database in that Firebase project; enable Analytics only if you configure a measurement ID. Add the production and preview domains to Firebase Authentication's authorized domains. Room access rules are in [`database.rules.json`](./database.rules.json), referenced by [`firebase.json`](./firebase.json). They require verified accounts, permit at most two room members, reject joins to stale or cleanup-pending rooms, and restrict host-only room operations.

The scheduled cleanup function in [`functions/index.js`](./functions/index.js) removes rooms after 48 hours without activity. It runs once daily, so deletion can occur up to roughly 24 hours after the inactivity window. Deploy both rules and functions before testing production behavior:

```bash
firebase deploy --only database,functions
```

If Firebase Hosting is also your web host, deploy it separately with `firebase deploy --only hosting`.

The Firebase CLI must be authenticated and pointed at the intended project. Scheduled functions require the appropriate Firebase billing plan and Cloud Scheduler/Functions APIs. The Firebase web API key is client configuration, not a server secret; restrict it in Firebase/Google Cloud settings as appropriate.

For browser notifications, enable Firebase Cloud Messaging, add the project's web push certificate public key as `VITE_FIREBASE_VAPID_KEY`, and deploy the database rules and `sendBrowserNotification` function. Users must opt in from Home. Account deletion uses the `deleteAccountData` callable function and also requires deployment.

## Production release checklist

Complete these operator-side steps for the intended Firebase and Vercel projects; the build and CI checks do not deploy either service:

- [ ] Confirm the Vercel project uses the intended Git repository, Vite settings, production branch, and environment variables for Preview and Production.
- [ ] Confirm Firebase Auth providers, sender-domain authorization, Realtime Database region, and active rules match the project referenced by the deployed client.
- [ ] Register the production and preview hostnames with Firebase App Check's web provider, configure `VITE_FIREBASE_APPCHECK_SITE_KEY`, verify valid traffic, and then enable enforcement for the Firebase products in use. The client warns in production if App Check is not configured.
- [ ] Deploy the rules and functions. Scheduled room cleanup requires billing and the relevant Google Cloud APIs; notification delivery requires FCM/VAPID setup.
- [ ] Resolve the remaining frontend dependency audit findings before launch. The current Firebase umbrella SDK lock includes two high-severity advisories under its unused Firestore dependency subtree (`@grpc/grpc-js` and `re2js`); Datecue uses Realtime Database, not Firestore. Track an upstream fix or remove the unused dependency subtree with compatibility tests rather than applying an untested override.
- [ ] Configure Firebase budget/usage alerts, database backup and restore procedures, and an error-monitoring destination. The current app error boundary logs to the browser console; no hosted error-monitoring integration is configured.
- [ ] Replace the legal-page draft details with the operator's legal name, privacy contact, and applicable jurisdiction, and have the published terms reviewed before accepting users.
- [ ] Deploy, then use test accounts to verify direct `/privacy` and `/terms` loads; email verification and Google sign-in; create/join as host and guest; rejection of a third participant; synced playback, chat, reactions, and disconnect recovery; title/thumbnail history; profile export and deletion; and notification opt-in if enabled. Use test accounts for destructive deletion checks.
- [ ] Review Firebase Function logs and Vercel deployment/runtime logs after the smoke test. Confirm the scheduled cleanup and account-deletion functions are deployed before relying on them.

The privacy and terms pages are an implementation draft, not legal advice. Do not launch publicly until the operator details and jurisdiction-specific terms are supplied and reviewed.

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