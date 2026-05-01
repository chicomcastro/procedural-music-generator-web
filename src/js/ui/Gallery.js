const GALLERY = [
  { name: 'Morning Light', seed: 42, bpm: '100', scale: 'major', tonic: '0', bars: '4', time: '4', density: '0.6', swing: '0' },
  { name: 'Blue Fog', seed: 7777, bpm: '72', scale: 'pentatonic_minor', tonic: '9', bars: '4', time: '4', density: '0.5', swing: '0.3' },
  { name: 'Night Drive', seed: 2048, bpm: '110', scale: 'dorian', tonic: '2', bars: '4', time: '4', density: '0.7', swing: '0.2' },
  { name: 'Cathedral', seed: 31415, bpm: '80', scale: 'harmonic_minor', tonic: '5', bars: '8', time: '4', density: '0.55', swing: '0' },
  { name: 'Rainy Café', seed: 1234, bpm: '90', scale: 'blues', tonic: '4', bars: '4', time: '4', density: '0.55', swing: '0.5' },
  { name: 'Stargazer', seed: 65535, bpm: '108', scale: 'lydian', tonic: '7', bars: '4', time: '4', density: '0.65', swing: '0' },
  { name: 'Midnight Walk', seed: 9999, bpm: '140', scale: 'natural_minor', tonic: '9', bars: '4', time: '4', density: '0.75', swing: '0' },
  { name: 'Sunflower', seed: 888, bpm: '120', scale: 'mixolydian', tonic: '0', bars: '4', time: '4', density: '0.65', swing: '0.1' },
];

const galleryList = document.getElementById('gallery-list');

export function initGallery({ onLoadSeed }) {
  for (const entry of GALLERY) {
    const card = document.createElement('div');
    card.className = 'gallery-card';

    const name = document.createElement('div');
    name.className = 'gallery-card-name';
    name.textContent = entry.name;

    const meta = document.createElement('div');
    meta.className = 'gallery-card-meta';
    meta.textContent = `seed ${entry.seed} · ${entry.scale} · ${entry.bpm} bpm`;

    card.appendChild(name);
    card.appendChild(meta);
    card.addEventListener('click', () => onLoadSeed(entry));
    galleryList.appendChild(card);
  }
}
