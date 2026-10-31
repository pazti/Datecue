importScripts(
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js",
)
importScripts(
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js",
)

const firebaseConfig = Object.fromEntries(
  new URLSearchParams(self.location.search),
)
firebase.initializeApp(firebaseConfig)

const messaging = firebase.messaging()
messaging.onBackgroundMessage((payload) => {
  const appBase = new URL("./", self.location.href)
  self.registration.showNotification(payload.notification?.title || "Datecue", {
    body: payload.notification?.body || "You have a new update.",
    data: { url: new URL(payload.data?.url || "#/home", appBase).href },
    icon: new URL("datecue-mark.svg", appBase).href,
  })
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = new URL(
    event.notification.data?.url || "#/home",
    new URL("./", self.location.href),
  )
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const currentClient = clients.find(
          (client) => new URL(client.url).origin === target.origin,
        )
        if (currentClient) {
          return currentClient
            .navigate(target.href)
            .then(() => currentClient.focus())
        }
        return self.clients.openWindow(target.href)
      }),
  )
})
