const CACHE_NAME = 'seedsong-v1';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './favicon.svg',
  './manifest.json',
  './js/main.js',
  './js/audio/AudioEngine.js',
  './js/audio/Click.js',
  './js/audio/SampleLibrary.js',
  './js/audio/Voice.js',
  './js/export/download.js',
  './js/export/midi.js',
  './js/export/wav.js',
  './js/generate/melody.js',
  './js/generate/progression.js',
  './js/generate/rhythm.js',
  './js/generate/rng.js',
  './js/generate/song.js',
  './js/scheduler/Scheduler.js',
  './js/scheduler/Transport.js',
  './js/theory/chords.js',
  './js/theory/notes.js',
  './js/theory/scales.js',
  './js/ui/Piano.js',
  './js/ui/ScoreCanvas.js',
  './sounds/A3.mp3',
  './sounds/Ab3.mp3',
  './sounds/B3.mp3',
  './sounds/Bb3.mp3',
  './sounds/C3.mp3',
  './sounds/D3.mp3',
  './sounds/Db3.mp3',
  './sounds/E3.mp3',
  './sounds/Eb3.mp3',
  './sounds/F3.mp3',
  './sounds/G3.mp3',
  './sounds/Gb3.mp3',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
