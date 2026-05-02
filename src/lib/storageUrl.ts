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
