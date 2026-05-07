/**
 * Converts a watch URL (VK Video, YouTube, etc.) into an embeddable iframe URL.
 * Returns the original URL if no known pattern matches.
 */
export function toEmbedUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  const url = rawUrl.trim();

  // Already an embed
  if (
    url.includes("video_ext.php") ||
    url.includes("youtube.com/embed/") ||
    url.includes("youtube-nocookie.com/embed/") ||
    url.includes("rutube.ru/play/embed/") ||
    url.includes("player.vimeo.com/video/")
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
      // /watch?v=ID
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      // /shorts/ID, /live/ID
      const m = u.pathname.match(/^\/(?:shorts|live|embed)\/([^/?#]+)/);
      if (m) return `https://www.youtube.com/embed/${m[1]}`;
    }

    // VK Video — обычная ссылка vk.com/video{oid}_{id} или vkvideo.ru/video...
    if (host === "vk.com" || host === "m.vk.com" || host === "vkvideo.ru" || host === "vk.ru") {
      const list = u.searchParams.get("list") || u.searchParams.get("hash");
      const extra = list ? `&hash=${encodeURIComponent(list)}` : "";
      const m = u.pathname.match(/video(-?\d+)_(\d+)/);
      if (m) {
        const oid = m[1];
        const id = m[2];
        return `https://vk.com/video_ext.php?oid=${oid}&id=${id}&hd=2&autoplay=0${extra}`;
      }
      // Ссылка вида ?z=video{oid}_{id}
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
