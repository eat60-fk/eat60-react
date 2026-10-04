self.addEventListener('notificationclick', event => {
  event.notification.close();
  const requestedUrl = event.notification.data?.url || '/';
  let target;
  try {
    target = new URL(requestedUrl, self.location.origin);
    if (target.origin !== self.location.origin) target = new URL('/', self.location.origin);
  } catch {
    target = new URL('/', self.location.origin);
  }

  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const existing = clients.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      const navigated = await existing.navigate(target.href).catch(() => null);
      return (navigated || existing).focus();
    }
    return self.clients.openWindow(target.href);
  }));
});
