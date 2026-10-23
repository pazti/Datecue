import { youtubeVideoIdFromUrl } from "./youtube"

const MAX_MESSAGE_LENGTH = 500
const MAX_URL_LENGTH = 500
const MIN_MESSAGE_LENGTH = 1

export function isValidYoutubeUrl(url: string): boolean {
  if (!url || url.length > MAX_URL_LENGTH) return false
  return youtubeVideoIdFromUrl(url) !== null
}

export function sanitizeMessage(text: string): string {
  return text.slice(0, MAX_MESSAGE_LENGTH).replace(/[\uD800-\uDBFF]$/, "")
}

export function isValidMessage(text: string): boolean {
  const trimmed = text.trim()
  return (
    trimmed.length >= MIN_MESSAGE_LENGTH && trimmed.length <= MAX_MESSAGE_LENGTH
  )
}

export function isValidReaction(emoji: string): boolean {
  const VALID_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "👋"]
  return VALID_REACTIONS.includes(emoji)
}

export function validatePlaybackState(state: unknown): boolean {
  if (!state || typeof state !== "object") return false
  const value = state as Record<string, unknown>
  return (
    typeof value.playing === "boolean" &&
    typeof value.currentTime === "number" &&
    Number.isFinite(value.currentTime) &&
    value.currentTime >= 0 &&
    value.currentTime <= 86400 &&
    typeof value.hostId === "string"
  )
}

export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : ""
  } catch {
    return ""
  }
}
