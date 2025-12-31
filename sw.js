/* eslint-disable no-restricted-globals */
const CACHE_VERSION = "v4";
const CACHE_NAME = `garden-fence-${CACHE_VERSION}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.bundle.min.css",
  "./dist/app.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/maskable-icon.svg",
  "./icons/ios/180.png",
  "./icons/ios/192.png",
  "./icons/ios/512.png",
];

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(
    APP_SHELL.map(async (url) => {
      try {
        const res = await fetch(url, { cache: "reload" });
        if (res.ok) await cache.put(url, res);
      } catch {
        // Ignore precache failures (offline / transient).
      }
    }),
  );
}

async function fetchAndCache(request) {
  const response = await fetch(request);
  if (response && response.status === 200) {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    precacheShell().then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("garden-fence-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const accept = request.headers.get("accept") || "";
  const isNavigation = request.mode === "navigate" || accept.includes("text/html");
  const isEnv = url.pathname.endsWith("/env.js") || url.pathname === "/env.js";
  const isCriticalAsset =
    url.pathname === "/dist/app.js" ||
    url.pathname === "/styles.bundle.min.css" ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/styles.css" ||
    url.pathname === "/app.min.js" ||
    url.pathname === "/app.js";

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  if (isEnv) {
    event.respondWith(
      fetchAndCache(request)
        .catch(() => caches.match(request))
    );
    return;
  }

  // JS/CSS are updated frequently but have stable URLs. Prefer fresh network responses so
  // users don't need to reinstall the PWA to pick up changes.
  if (isCriticalAsset) {
    event.respondWith(
      fetchAndCache(request).catch(() => caches.match(request)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetchAndCache(request)
        .catch(() => undefined);
    })
  );
});
