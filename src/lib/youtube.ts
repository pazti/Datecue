const VIDEO_ID_PATTERN = /^[\w-]{11}$/

export function youtubeVideoIdFromUrl(value: string): string | null {
  try {
    const parsed = new URL(value.trim())
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "")

    if (hostname === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0]
      return id && VIDEO_ID_PATTERN.test(id) ? id : null
    }

    if (
      !["youtube.com", "m.youtube.com", "music.youtube.com"].includes(hostname)
    )
      return null

    const path = parsed.pathname.split("/").filter(Boolean)
    const id =
      parsed.pathname === "/watch"
        ? parsed.searchParams.get("v")
        : ["embed", "shorts", "live"].includes(path[0] ?? "")
          ? path[1]
          : null

    return id && VIDEO_ID_PATTERN.test(id) ? id : null
  } catch {
    return null
  }
}

export function canonicalYoutubeUrl(value: string): string | null {
  const id = youtubeVideoIdFromUrl(value)
  return id ? `https://www.youtube.com/watch?v=${id}` : null
}
