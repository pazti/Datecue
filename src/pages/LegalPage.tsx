import { Icon } from "../components/Logo"

export type LegalDocument = "privacy" | "terms"
export const LEGAL_VERSION = "2026-10-31"

interface Props {
  document: LegalDocument
  darkMode: boolean
  onToggleDark: () => void
  onBack: () => void
  onNavigate: (document: LegalDocument) => void
}

const DOCUMENTS = {
  privacy: {
    title: "Privacy Policy",
    updated: "October 31, 2026",
    intro:
      "This policy explains what Datecue collects and how it is used when you create an account, join a room, or watch together. Datecue is a shared viewing tool, not a dating service, and it does not verify anyone's identity or relationship.",
    sections: [
      {
        title: "Information we use",
        paragraphs: [
          "Account information includes your Firebase user identifier, email address, and display name. Room information includes room codes, participant presence, messages, reactions, playback state, the current YouTube video URL and title, and queued video URLs, titles, and the identity of the participant who added each video.",
          "When watch history is enabled, Datecue saves the video title and URL, thumbnail URL, room identifier, and watch duration to your account. The app also stores in-app notifications and basic product events such as room creation, join attempts, playback starts, and session duration when Firebase Analytics is enabled for the project.",
          "Optional scheduled rooms store their selected video, title, room code, scheduled time, and reminder status. Your account may also store private playback checkpoints, room recaps (including participant display names and selected chat highlights), and accessibility preferences.",
        ],
      },
      {
        title: "How information is used",
        paragraphs: [
          "Datecue uses this information to authenticate accounts, operate two-person rooms, synchronize playback, deliver chat and reactions, show notifications, and maintain watch history and aggregate product measurements.",
          "Room codes and invite links are access paths, not encryption. Anyone who receives an invite may try to join while a room is available. Do not put sensitive personal information in room messages, and do not post an invite publicly if you intend to keep a room private.",
        ],
      },
      {
        title: "Service providers and YouTube",
        paragraphs: [
          "Datecue uses Firebase Authentication, Realtime Database, and (when browser alerts are enabled) Firebase Cloud Messaging. YouTube videos are embedded using YouTube's player and metadata services. Those providers may receive technical information such as your IP address, browser details, and player activity under their own privacy terms and settings. Browser notification tokens are stored with your account so notifications can be delivered to devices you enable.",
          "Datecue does not host the videos. Opening or playing a video is also subject to YouTube's terms and privacy policy.",
        ],
      },
      {
        title: "Retention and security",
        paragraphs: [
          "Room data is removed when the host ends a room or when scheduled cleanup removes a room after approximately 48 hours without activity. Cleanup runs daily, so removal may take up to about 24 hours longer. Account profile, watch history, statistics, notifications, scheduled rooms, playback checkpoints, recaps, and accessibility preferences remain stored until you delete your account or the service operator removes them.",
          "Firebase Authentication and database rules restrict access to verified accounts and room members. Room chat and playback data are not end-to-end encrypted. No online service can guarantee absolute security.",
        ],
      },
      {
        title: "Your choices",
        paragraphs: [
          "You can choose what to include in your display name, messages, and queued videos, leave rooms, clear notifications, turn off browser alerts, download a JSON copy of your account data, or delete your account from your profile. Account deletion removes your profile, history, statistics, notifications, scheduled rooms, playback checkpoints, recaps, accessibility preferences, rooms you host, and queued videos you added to other rooms. The service operator's privacy contact must be published before public launch so you can make other access requests.",
        ],
      },
      {
        title: "Changes and contact",
        paragraphs: [
          "This policy may change as Datecue's features or legal requirements change. The updated date above indicates the latest revision. The service operator's legal name, privacy contact, and applicable jurisdiction should be supplied before public launch.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    updated: "October 31, 2026",
    intro:
      "These terms cover your use of Datecue, a service for watching third-party YouTube videos together in private, two-person rooms. By using Datecue, you agree to these terms and the applicable YouTube terms for embedded videos.",
    sections: [
      {
        title: "Accounts and rooms",
        paragraphs: [
          "You are responsible for your account credentials and activity performed through your account. Email/password accounts must verify their email address before using rooms. Keep room codes and invite links limited to the people you intend to invite.",
          "Rooms are limited to two participants. The host can change the selected video, transfer is offered to a participant when the host disconnects, and the host can end a room. Rooms inactive for approximately 48 hours may be removed by scheduled cleanup; the cleanup runs daily, so removal may take longer than 48 hours.",
        ],
      },
      {
        title: "Videos and third-party services",
        paragraphs: [
          "Datecue provides synchronization and conversation tools; it does not provide, own, or grant rights to videos. You must have the right to access the content you choose. YouTube may block embedding, restrict availability, or change its player without notice.",
          "Your use of YouTube content and the YouTube player is governed by YouTube's terms and policies. Datecue is not responsible for third-party content, availability, or services.",
        ],
      },
      {
        title: "Your conduct and content",
        paragraphs: [
          "Do not use Datecue to violate law or another person's rights, harass or threaten someone, distribute malicious material, interfere with the service, or attempt to access rooms or accounts without authorization.",
          "You retain responsibility for messages, display names, and queued videos you submit. You authorize Datecue to store and display that content as needed to provide room chat, presence, the shared watch queue, notifications, and account history to you and the other room participant.",
          "Scheduled-room times, private playback checkpoints, watch recaps, and accessibility preferences are saved to your account to provide those optional features. Recaps may include display names and selected room chat highlights.",
        ],
      },
      {
        title: "Availability and termination",
        paragraphs: [
          "Datecue is provided on an evolving basis and may change, be interrupted, or be discontinued. The host may end a room at any time. The service operator may suspend access for misuse, security reasons, or legal requirements.",
          "You may stop using Datecue at any time. Ending a room removes its live room data; it does not automatically remove watch history, statistics, or notifications already saved to an account. You can delete your account from your profile to remove those saved details and close rooms you host.",
        ],
      },
      {
        title: "Disclaimers and liability",
        paragraphs: [
          "To the extent permitted by law, Datecue is provided without warranties of uninterrupted availability, synchronization accuracy, or compatibility with every video. Nothing in these terms limits rights or remedies that cannot lawfully be limited in your jurisdiction.",
          "To the extent permitted by law, the service operator is not liable for indirect or consequential losses arising from use of Datecue or third-party video services. Any mandatory consumer protections remain unaffected.",
        ],
      },
      {
        title: "Changes and contact",
        paragraphs: [
          "These terms may be updated as the service changes. Continued use after an update takes effect means you accept the revised terms where permitted by law. The service operator's legal name, contact details, and applicable jurisdiction should be supplied before public launch.",
        ],
      },
    ],
  },
} as const

export default function LegalPage({
  document,
  darkMode,
  onToggleDark,
  onBack,
  onNavigate,
}: Props) {
  const page = DOCUMENTS[document]
  const otherDocument = document === "privacy" ? "terms" : "privacy"

  return (
    <main
      className={`film-grain surface-wash min-h-[100dvh] ${
        darkMode ? "bg-night text-ivory" : "bg-ivory text-ink"
      }`}
    >
      <header className="sticky top-0 z-20 border-b hairline bg-ivory/90 px-5 py-4 backdrop-blur-xl dark:bg-night/90 sm:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <button
            className="button-quiet focus-ring flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold"
            onClick={onBack}
            type="button"
          >
            <Icon name="arrow-left" size={16} /> Back
          </button>
          <nav
            aria-label="Legal documents"
            className="flex items-center gap-4 text-sm"
          >
            <button
              className="focus-ring underline underline-offset-4"
              onClick={() => onNavigate("privacy")}
              type="button"
            >
              Privacy
            </button>
            <button
              className="focus-ring underline underline-offset-4"
              onClick={() => onNavigate("terms")}
              type="button"
            >
              Terms
            </button>
          </nav>
          <button
            aria-label={
              darkMode ? "Switch to light mode" : "Switch to dark mode"
            }
            className="button-quiet focus-ring flex h-10 w-10 items-center justify-center rounded-full border"
            onClick={onToggleDark}
            type="button"
          >
            <Icon name={darkMode ? "sun" : "moon"} size={16} />
          </button>
        </div>
      </header>
      <article className="page-enter mx-auto max-w-3xl px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
        <p className="eyebrow text-coral">Datecue / Legal</p>
        <h1 className="mt-4 text-5xl leading-[.95] sm:text-7xl">
          {page.title}
        </h1>
        <p className="mt-4 text-sm text-muted-ink">
          Effective date: {page.updated}
        </p>
        <p className="mt-8 max-w-2xl text-lg leading-relaxed">{page.intro}</p>
        <div className="mt-12 space-y-12 border-t hairline pt-8 sm:mt-16 sm:space-y-14">
          {page.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-2xl">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p
                  className="mt-3 leading-relaxed text-muted-ink"
                  key={paragraph}
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
        <p className="mt-12 border-t hairline pt-6 text-sm text-muted-ink">
          Also read the{" "}
          <button
            className="text-coral underline underline-offset-2"
            onClick={() => onNavigate(otherDocument)}
            type="button"
          >
            {otherDocument === "privacy"
              ? "Privacy Policy"
              : "Terms of Service"}
          </button>
          .
        </p>
      </article>
    </main>
  )
}
