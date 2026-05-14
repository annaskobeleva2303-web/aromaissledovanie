import { toast } from "sonner";

/**
 * Lightweight build-version checker (no Service Worker required).
 *
 * Strategy: fetch /index.html (no-store) and extract the hashed asset filenames
 * (e.g. /assets/index-ABC123.js). When the hash changes between checks → a new
 * build is live. Show a sticky toast with a "Обновить" button.
 *
 * Also defensively unregisters any stray Service Workers and clears their
 * caches, in case a user previously had a PWA shell installed.
 */

const CHECK_INTERVAL_MS = 60_000;
let initialFingerprint: string | null = null;
let updateNoticeShown = false;

async function fetchFingerprint(): Promise<string | null> {
  try {
    const res = await fetch(`/index.html?_=${Date.now()}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Pull all hashed asset references — order-stable signature.
    const matches = html.match(/\/assets\/[A-Za-z0-9_.-]+\.(?:js|css)/g);
    if (!matches || matches.length === 0) return null;
    return matches.sort().join("|");
  } catch {
    return null;
  }
}

function showUpdateToast() {
  if (updateNoticeShown) return;
  updateNoticeShown = true;
  toast("Доступно обновление", {
    description: "Загрузите новую версию приложения.",
    duration: Infinity,
    action: {
      label: "Обновить",
      onClick: () => {
        // Полная перезагрузка с обходом кэша.
        const url = new URL(window.location.href);
        url.searchParams.set("_v", Date.now().toString());
        window.location.replace(url.toString());
      },
    },
  });
}

async function unregisterStaleServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* noop */
  }
}

export function startVersionCheck() {
  // Skip in dev / preview iframes — only matters in production.
  if (import.meta.env.DEV) return;

  void unregisterStaleServiceWorkers();

  const tick = async () => {
    const fp = await fetchFingerprint();
    if (!fp) return;
    if (initialFingerprint === null) {
      initialFingerprint = fp;
      return;
    }
    if (fp !== initialFingerprint) showUpdateToast();
  };

  void tick();
  window.setInterval(tick, CHECK_INTERVAL_MS);
  window.addEventListener("focus", () => void tick());
}
