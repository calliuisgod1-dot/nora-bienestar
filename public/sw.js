// Nora PWA Service Worker
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: 'https://picsum.photos/seed/nora-heart/192/192', // A pretty heart icon
      badge: 'https://picsum.photos/seed/nora-badge/96/96',
      image: data.image || 'https://picsum.photos/seed/nora-well/800/400', // Optional hero image
      data: {
        url: data.url || '/'
      },
      vibrate: [200, 100, 200],
      tag: 'nora-notification',
      renotify: true,
      actions: [
        { action: 'open', title: 'Abrir Bitácora ✨' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } catch (error) {
    console.error('Error handling push event:', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Open the app and navigate to the chat
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url || '/');
      }
    })
  );
});
