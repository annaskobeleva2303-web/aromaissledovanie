// Rewrites legacy direct Supabase Storage URLs onto the reverse proxy used by
// the production frontend. Older `oils.image_url` values were written before
// the reverse proxy existed and still point at `*.supabase.co/storage/...`,
// which is now blocked from the browser by CORS / network policy.
//
// We rewrite at render time so that no DB migration is required and so that
// new uploads (which already go through the proxied client) keep working.
const PROXY_BASE = "https://aromasmysly.ru/supabase-api";
const LEGACY_HOSTS = [
  "https://oxnaspltdqqwyaxasqnr.supabase.co",
];

export function proxiedStorageUrl(url: string | null | undefined): string {
  if (!url) return "";
  for (const host of LEGACY_HOSTS) {
    if (url.startsWith(host)) {
      return PROXY_BASE + url.slice(host.length);
    }
  }
  return url;
}

// The `oil-media` bucket is private: meditation files require access verification
// through RLS, so they must be served via short-lived signed URLs rather than
// public URLs. Extract the object path from a stored file_url and sign it.
export function extractOilMediaPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = "/oil-media/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
}

export async function signedOilMediaUrl(
  fileUrl: string | null | undefined,
  expiresIn = 3600,
): Promise<string> {
  if (!fileUrl) return "";
  const path = extractOilMediaPath(fileUrl);
  if (!path) return proxiedStorageUrl(fileUrl);
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.storage
    .from("oil-media")
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return proxiedStorageUrl(fileUrl);
  return data.signedUrl;
}
