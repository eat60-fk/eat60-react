const soundPaths = {
  announced: '/sounds/announced-banner.mp3',
  notification: '/sounds/notification.mp3',
  orderAlert: '/sounds/order-alert.mp3',
  orderArrived: '/sounds/Order-Arrived.mp3',
  burgerCrash: '/sounds/dead-burger.mp3',
  snake: '/sounds/snake-psh.mp3',
  riderCrash: '/sounds/rider-crash.mp3'
};

export function playAppSound(name, volume = 0.8) {
  const path = soundPaths[name];
  if (!path || typeof Audio === 'undefined') return;
  const audio = new Audio(path);
  audio.preload = 'auto';
  audio.volume = Math.max(0, Math.min(1, volume));
  audio.play().catch(() => {});
}
