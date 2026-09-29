const YOUTUBE_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
const UNSAFE_CHARS = /[<>{}"`]/g
const MAX_MESSAGE_LENGTH = 500
const MAX_URL_LENGTH = 500
const MIN_MESSAGE_LENGTH = 1

export function isValidYoutubeUrl(url: string): boolean {
  if (!url || url.length > MAX_URL_LENGTH) return false
  return YOUTUBE_REGEX.test(url)
}

export function sanitizeMessage(text: string): string {
  return text.slice(0, MAX_MESSAGE_LENGTH).replace(UNSAFE_CHARS, "")
}

export function isValidMessage(text: string): boolean {
  const trimmed = text.trim()
  return (
    trimmed.length >= MIN_MESSAGE_LENGTH &&
    trimmed.length <= MAX_MESSAGE_LENGTH &&
    !UNSAFE_CHARS.test(text)
  )
}

export function isValidReaction(emoji: string): boolean {
  const VALID_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "👋"]
  return VALID_REACTIONS.includes(emoji)
}

export function validatePlaybackState(state: any): boolean {
  return (
    typeof state.playing === "boolean" &&
    typeof state.currentTime === "number" &&
    state.currentTime >= 0 &&
    state.currentTime <= 86400 &&
    typeof state.hostId === "string"
  )
}

export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.href
  } catch {
    return ""
  }
}
