// public/service-worker.js

self.addEventListener('push', event => {
  // Fallback data if the push message is empty
  let data = {
    title: 'New Notification',
    body: 'You have a new update from V3 Services.',
  };

  // Try to parse the data from the push event
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.error('Push event data could not be parsed:', e);
    }
  }

  const options = {
    body: data.body,
    icon: '/logo192.png', // Make sure you have an icon at /public/logo192.png
    badge: '/logo72.png', // And a smaller one at /public/logo72.png
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});