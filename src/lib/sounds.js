const soundPaths = {
  announced: '/sounds/announced-banner.mp3',
  notification: '/sounds/notification.mp3',
  orderAlert: '/sounds/order-alert.mp3',
  orderArrived: '/sounds/Order-Arrived.mp3',
  burgerCrash: '/sounds/dead-burger.mp3',
  burgerTap: '/sounds/burger-tap.mp3',
  coinCollect: '/sounds/coin-collect.mp3',
  snakeEat: '/sounds/eating-food-snakes.mp3',
  gameHit: '/sounds/gothit-burger-snake-rider.mp3',
  snake: '/sounds/snake-psh.mp3',
  riderCrash: '/sounds/rider-crash.mp3'
};

let audioContext = null;
const decodedSounds = new Map();
const loadingSounds = new Map();

function getAudioContext() {
  if (audioContext) return audioContext;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  try { audioContext = new Context(); }
  catch { return null; }
  return audioContext;
}

function loadSound(name) {
  if (decodedSounds.has(name)) return Promise.resolve(decodedSounds.get(name));
  if (loadingSounds.has(name)) return loadingSounds.get(name);
  const context = getAudioContext();
  const path = soundPaths[name];
  if (!context || !path) return Promise.resolve(null);
  const loading = fetch(path)
    .then(response => {
      if (!response.ok) throw new Error(`Could not load ${path}`);
      return response.arrayBuffer();
    })
    .then(data => context.decodeAudioData(data))
    .then(buffer => {
      decodedSounds.set(name, buffer);
      loadingSounds.delete(name);
      return buffer;
    })
    .catch(() => {
      loadingSounds.delete(name);
      return null;
    });
  loadingSounds.set(name, loading);
  return loading;
}

export function unlockAppSounds(names = []) {
  if (typeof window === 'undefined') return;
  const context = getAudioContext();
  if (context?.state === 'suspended') context.resume().catch(() => {});
  names.forEach(name => { void loadSound(name); });
}

function playWithAudioElement(path, volume) {
  if (typeof Audio === 'undefined') return;
  const audio = new Audio(path);
  audio.preload = 'auto';
  audio.volume = Math.max(0, Math.min(1, volume));
  audio.play().catch(() => {});
}

export function playAppSound(name, volume = 0.8) {
  const path = soundPaths[name];
  if (!path || typeof window === 'undefined') return;
  const context = getAudioContext();
  if (!context) return playWithAudioElement(path, volume);
  const playBuffer = buffer => {
    if (!buffer) return playWithAudioElement(path, volume);
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volume));
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(context.destination);
    const start = () => {
      try { source.start(0); } catch {}
    };
    if (context.state === 'suspended') context.resume().then(start).catch(() => {});
    else start();
  };
  const buffer = decodedSounds.get(name);
  if (buffer) playBuffer(buffer);
  else void loadSound(name).then(playBuffer);
}

// Mobile browsers suspend audio until a direct user gesture. Unlock the shared
// context early so sounds played later from realtime events and React effects
// can work after the customer or admin has interacted with the app.
if (typeof window !== 'undefined') {
  let unlocked = false;
  const unlockFromGesture = () => {
    if (unlocked) return;
    unlocked = true;
    unlockAppSounds(['notification', 'orderAlert', 'orderArrived', 'announced']);
    window.removeEventListener('pointerdown', unlockFromGesture, true);
    window.removeEventListener('touchend', unlockFromGesture, true);
    window.removeEventListener('keydown', unlockFromGesture, true);
  };
  window.addEventListener('pointerdown', unlockFromGesture, true);
  window.addEventListener('touchend', unlockFromGesture, true);
  window.addEventListener('keydown', unlockFromGesture, true);
}
