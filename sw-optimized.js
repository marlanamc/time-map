/* eslint-disable no-restricted-globals */
const CACHE_VERSION = "v9-optimized";
const CACHE_NAME = `garden-fence-${CACHE_VERSION}`;

// Critical app shell - cache first for instant loading
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

// Critical CSS and JS - network first for updates
const CRITICAL_ASSETS = [
  "./assets/main-*.css",
  "./assets/main-*.js",
  "./assets/vendor-*.js",
];

// Static assets - cache first
const STATIC_ASSETS = [
  "./assets/*.png",
  "./assets/*.svg",
  "./env.js",
];

// Cache strategies
const STRATEGIES = {
  // Cache first for static assets (fastest)
  cacheFirst: async (request) => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    
    try {
      const response = await fetch(request);
      if (response.ok) {
        const copy = response.clone();
        cache.put(request, copy);
      }
      return response;
    } catch {
      return new Response('Offline', { status: 503 });
    }
  },

  // Network first for dynamic content (freshest)
  networkFirst: async (request) => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const copy = response.clone();
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, copy);
      }
      return response;
    } catch {
      const cache = await caches.open(CACHE_NAME);
      return cache.match(request);
    }
  },

  // Stale while revalidate for balanced approach
  staleWhileRevalidate: async (request) => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    
    const fetchPromise = fetch(request).then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    }).catch(() => cached);
    
    return cached || fetchPromise;
  }
};

// Precache critical assets
async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(
    APP_SHELL.map(async (url) => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) await cache.put(url, res);
      } catch {
        // Ignore precache failures (offline / transient)
      }
    }),
  );
}

// Background sync for offline actions
async function syncOfflineActions() {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  clients.forEach((client) => client.postMessage({ type: "SYNC_OFFLINE_ACTIONS" }));
}

// Clear old caches
async function clearOldCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith("garden-fence-") && key !== CACHE_NAME)
      .map((key) => {
        console.log(`[SW] Clearing old cache: ${key}`);
        return caches.delete(key);
      }),
  );
  await precacheShell();
}

// Broadcast to all clients
async function broadcastToClients(message) {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  clients.forEach((client) => client.postMessage(message));
}

// Performance monitoring
function logPerformance() {
  if (self.performance && self.performance.memory) {
    console.log(`[SW] Memory usage: ${Math.round(self.performance.memory.usedJSHeapSize / 1048576)}MB`);
  }
}

// Service Worker Events
self.addEventListener("sync", (event) => {
  if (event.tag === "garden-fence-sync") {
    event.waitUntil(syncOfflineActions());
  }
});

self.addEventListener("install", (event) => {
  console.log(`[SW] Installing version ${CACHE_VERSION}`);
  event.waitUntil(precacheShell());
});

self.addEventListener("activate", (event) => {
  console.log(`[SW] Activating version ${CACHE_VERSION}`);
  event.waitUntil(
    clearOldCaches()
      .then(() => self.clients.claim())
      .then(() => broadcastToClients({ type: "SW_VERSION", version: CACHE_VERSION }))
      .then(() => logPerformance())
  );
});

self.addEventListener("message", (event) => {
  const type = event?.data?.type;
  
  switch (type) {
    case "SKIP_WAITING":
      self.skipWaiting();
      break;
    case "GET_VERSION":
      event.source?.postMessage({ type: "SW_VERSION", version: CACHE_VERSION });
      break;
    case "CLEAR_CACHES":
      event.waitUntil(
        clearOldCaches()
          .then(() => event.source?.postMessage({ type: "CACHES_CLEARED" }))
          .catch(() => event.source?.postMessage({ type: "CACHES_CLEAR_FAILED" }))
      );
      break;
    case "FORCE_REFRESH":
      event.waitUntil(
        clearOldCaches()
          .then(() => broadcastToClients({ type: "FORCE_REFRESH" }))
      );
      break;
  }
});

// Enhanced fetch event with smart caching
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const accept = request.headers.get("accept") || "";
  const isNavigation = request.mode === "navigate" || accept.includes("text/html");
  const isEnv = url.pathname.endsWith("/env.js") || url.pathname === "/env.js";
  
  // Determine asset type for strategy selection
  const isCSS = url.pathname.endsWith(".css") || accept.includes("text/css");
  const isJS = url.pathname.endsWith(".js") && !url.pathname.includes("node_modules");
  const isImage = url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i);
  const isFont = url.pathname.match(/\.(woff|woff2|ttf|eot)$/i);
  
  // Navigation requests - network first with cache fallback
  if (isNavigation) {
    event.respondWith(STRATEGIES.networkFirst(request));
    return;
  }

  // Environment file - network first
  if (isEnv) {
    event.respondWith(STRATEGIES.networkFirst(request));
    return;
  }

  // Critical CSS/JS - stale while revalidate for balance
  if (isCSS || isJS) {
    event.respondWith(STRATEGIES.staleWhileRevalidate(request));
    return;
  }

  // Static assets - cache first for speed
  if (isImage || isFont) {
    event.respondWith(STRATEGIES.cacheFirst(request));
    return;
  }

  // Default to cache first for remaining assets
  event.respondWith(STRATEGIES.cacheFirst(request));
});

// Performance optimization - cleanup unused caches periodically
self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEANUP_CACHE") {
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => {
        return cache.keys().then(requests => {
          // Keep only recently used assets (last 7 days)
          const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
          return Promise.all(
            requests.map(request => {
              return cache.match(request).then(response => {
                if (response && response.headers.get('date')) {
                  const responseDate = new Date(response.headers.get('date')).getTime();
                  if (responseDate < cutoff) {
                    return cache.delete(request);
                  }
                }
              });
            })
          );
        });
      })
    );
  }
});
