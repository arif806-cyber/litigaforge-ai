/* LitigaForge push handling, imported by the Workbox-generated service worker (sw.js).
 * Without this the browser receives pushes but never shows them. */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "LitigaForge";
  const options = {
    body: data.body || "",
    icon: "/mcp-icon.png",
    badge: "/mcp-icon.png",
    data: { url: data.url || "/" },
  };
  if (data.tag) {
    options.tag = data.tag; // the same matter replaces, never stacks
    options.renotify = true;
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== target.origin) continue;
      try {
        if ("navigate" in client) await client.navigate(target.href);
      } catch {
        /* uncontrolled tab: focusing is still useful */
      }
      return client.focus();
    }
    return self.clients.openWindow(target.href);
  })());
});
