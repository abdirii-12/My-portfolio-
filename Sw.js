self.addEventListener("install", (event) => {
  console.log("Service Worker Installed");
  event.waitUntil(
    caches.open("elijah-tech-v1").then((cache) => {
      return cache.addAll([
        "./",
        "./index.html",
        "./style.css",
        "./manifest.json"
      ]);
    })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
