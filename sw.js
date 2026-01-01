/* eslint-disable no-restricted-globals */
const CACHE_VERSION = "v8";
const CACHE_NAME = `garden-fence-${CACHE_VERSION}`;

const APP_SHELL = [
  "./",
  "./index.html",
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
        const res = await fetch(url, { cache: "no-store" });
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

async function clearGardenFenceCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith("garden-fence-"))
      .map((key) => {
        console.log(`[SW] Clearing cache: ${key}`);
        return caches.delete(key);
      }),
  );
  await precacheShell();
}

async function broadcastToClients(message) {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  clients.forEach((client) => client.postMessage(message));
}

self.addEventListener("sync", (event) => {
  if (event.tag !== "garden-fence-sync") return;
  event.waitUntil(
    broadcastToClients({ type: "PROCESS_SYNC_QUEUE" }).catch(() => {}),
  );
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    precacheShell()
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
            .map((key) => {
              console.log(`[SW] Deleting old cache: ${key}`);
              return caches.delete(key);
            })
        )
      )
      .then(() => {
        console.log(`[SW] Activated with cache: ${CACHE_NAME}`);
        return self.clients.claim();
      })
      .then(() => broadcastToClients({ type: "SW_VERSION", version: CACHE_VERSION }))
  );
});

self.addEventListener("message", (event) => {
  const type = event?.data?.type;
  if (type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (type === "GET_VERSION") {
    event.source?.postMessage({ type: "SW_VERSION", version: CACHE_VERSION });
    return;
  }
  if (type === "CLEAR_CACHES") {
    event.waitUntil(
      clearGardenFenceCaches()
        .then(() => event.source?.postMessage({ type: "CACHES_CLEARED" }))
        .catch(() => event.source?.postMessage({ type: "CACHES_CLEAR_FAILED" })),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const accept = request.headers.get("accept") || "";
  const isNavigation = request.mode === "navigate" || accept.includes("text/html");
  const isEnv = url.pathname.endsWith("/env.js") || url.pathname === "/env.js";
  
  // CSS and JS files that change frequently - always fetch from network first
  const isCSS = url.pathname.endsWith(".css") || accept.includes("text/css");
  const isJS = url.pathname.endsWith(".js") && !url.pathname.includes("node_modules");
  const isCriticalAsset = isCSS || isJS;

  if (isNavigation) {
    // Network first for HTML to get latest version
    event.respondWith(
      fetch(request, { cache: "no-store" })
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
    // Network first for env.js
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Network-first strategy for CSS and JS - always try network first, fallback to cache
  if (isCriticalAsset) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for static assets (icons, etc.)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => undefined);
    })
  );
});
