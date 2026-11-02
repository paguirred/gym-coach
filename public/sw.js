// Service worker con estrategia RED PRIMERO (network-first):
// con señal, siempre trae la última versión y refresca el caché;
// sin señal, sirve la última copia cacheada. Así una versión nueva
// aparece sola al recargar, sin tener que limpiar caché a mano.
const CACHE = "coach-g3000-v24";
const SHELL = [
  "/",
  "/index.html",
  "/css/styles.css",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/js/app.js",
  "/js/firebase.js",
  "/js/firebase-config.js",
  "/js/data.js",
  "/js/profiles.js",
  "/js/exercises.js",
  "/js/progression.js",
  "/js/session.js",
  "/js/animations.js",
  "/js/prefs.js",
  "/js/draft.js",
  "/js/history.js",
  "/js/timer.js",
  "/js/voice.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // No interceptamos Firestore/Auth ni CDNs externos: dejamos pasar a la red.
  if (url.origin !== self.location.origin) return;

  // RED PRIMERO: intenta la red, guarda copia fresca en caché, y si no hay
  // señal cae al caché (o al index.html para navegaciones).
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((cached) => cached || caches.match("/index.html"))
      )
  );
});
