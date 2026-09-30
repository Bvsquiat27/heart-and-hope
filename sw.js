/* Hearth & Hope — service worker
   Cache shell for offline home/resources/directory/about.
   Network-first with stale-while-revalidate for updates.
   Never invent medical content beyond what's cached.
*/
const CACHE_VERSION = "hearth-hope-v1.6.14.6";
const SHELL_CACHE = CACHE_VERSION + "-shell";

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./js/haptics.js",
  "./js/budget.js",
  "./js/support.js",
  "./js/geo.js",
  "./js/beacon.js",
  "./js/mom-tools.js",
  "./js/account.js",
  "./js/centers-filter.js",
  "./js/firebase-beacon-config.js",
  "./audio/chime.ogg",
  "./audio/lullaby.ogg",
  "./audio/ping.ogg",
  "./data/centers.js",
  "./data/zips.js",
  "./data/zip-coords.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-180.png",
  "./icons/icon-96.png",
  "./icons/icon-32.png",
  "./icons/icon-512-maskable.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith("hearth-hope-") && k !== SHELL_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isNavigation(request) {
  return request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");
}

/* Network-first, fall back to cache; update cache on success (stale-while-revalidate flavor) */
async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok && request.method === "GET") {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (isNavigation(request)) {
      const shell = await cache.match("./index.html") || await cache.match("./");
      if (shell) return shell;
    }
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  /* Only handle same-origin app assets — never invent remote medical content */
  if (!isSameOrigin(url)) return;

  event.respondWith(networkFirst(request));
});

/* Local / page-triggered notifications (no Web Push subscription yet) */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || "#postpartum";
  const dest = raw.startsWith("#") ? "./" + raw : raw;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          try {
            client.postMessage({ type: "hearth-ember-open", url: raw });
          } catch (_) {}
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(dest);
    })
  );
});
