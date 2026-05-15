/**
 * Converts a watch URL (VK Video, YouTube, etc.) into an embeddable iframe URL.
 * Returns the original URL if no known pattern matches.
 *
 * IMPORTANT: If a URL is already an embed (vk.com/video_ext.php, youtube embed,
 * rutube embed, vimeo player), it is returned UNTOUCHED — do not strip params.
 */
export function isRutubeEmbed(url: string): boolean {
  if (!url) return false;
  return /(?:^|\/\/)(?:www\.)?rutube\.ru\/(?:play\/embed|video)\//i.test(url.trim());
}

export function toEmbedUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  const url = rawUrl.trim();

  // Already an embed — return AS-IS, never re-parse, never lose params (oid/id/hash).
  if (
    /\/video_ext\.php\b/i.test(url) ||
    /youtube(?:-nocookie)?\.com\/embed\//i.test(url) ||
    /rutube\.ru\/play\/embed\//i.test(url) ||
    /player\.vimeo\.com\/video\//i.test(url)
  ) {
    return url;
  }

  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    // YouTube
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      const m = u.pathname.match(/^\/(?:shorts|live|embed)\/([^/?#]+)/);
      if (m) return `https://www.youtube.com/embed/${m[1]}`;
    }

    // VK Video — vk.com/video{oid}_{id} (или vkvideo.ru / vk.ru / m.vk.com)
    if (host === "vk.com" || host === "m.vk.com" || host === "vkvideo.ru" || host === "vk.ru") {
      // Только настоящий hash подходит для приватных/preview видео. list — это плейлист, не hash.
      const hash = u.searchParams.get("hash");
      const extra = hash ? `&hash=${encodeURIComponent(hash)}` : "";

      const m = u.pathname.match(/video(-?\d+)_(\d+)/);
      if (m) {
        return `https://vk.com/video_ext.php?oid=${m[1]}&id=${m[2]}&hd=2&autoplay=0${extra}`;
      }
      const z = u.searchParams.get("z") || "";
      const mz = z.match(/video(-?\d+)_(\d+)/);
      if (mz) {
        return `https://vk.com/video_ext.php?oid=${mz[1]}&id=${mz[2]}&hd=2&autoplay=0${extra}`;
      }
    }

    // Rutube
    if (host.endsWith("rutube.ru")) {
      const m = u.pathname.match(/\/video\/([^/?#]+)/);
      if (m) return `https://rutube.ru/play/embed/${m[1]}`;
    }

    // Vimeo
    if (host === "vimeo.com") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      if (/^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    // not a URL — return as-is
  }

  return url;
}
