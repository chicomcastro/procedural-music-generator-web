import { createVoice } from '../audio/Voice.js';
import { getPlaybackFor } from '../audio/SampleLibrary.js';

/** @param {Object} song @param {Object} transport @returns {Promise<AudioBuffer>} */
export async function renderSongToBuffer(song, transport, { sampleRate = 44100, tailSeconds = 1.5 } = {}) {
  const beatDuration = 60 / transport.bpm;
  const lengthSec = song.lengthBeats * beatDuration + tailSeconds;
  const offline = new OfflineAudioContext(2, Math.ceil(sampleRate * lengthSec), sampleRate);

  const compressor = offline.createDynamicsCompressor();
  const masterGain = offline.createGain();
  masterGain.gain.value = 0.8;
  masterGain.connect(compressor);
  compressor.connect(offline.destination);

  for (const ev of song.events) {
    const { buffer, playbackRate } = getPlaybackFor(ev.midi);
    const when = ev.atBeat * beatDuration;
    const dur = ev.durationBeats * beatDuration;
    createVoice(offline, masterGain, {
      buffer,
      playbackRate,
      velocity: ev.velocity,
      when,
      duration: dur,
      releaseTime: 0.25,
    });
  }

  return offline.startRendering();
}

function writeAscii(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

/** @param {AudioBuffer} buf @returns {Uint8Array} 16-bit PCM WAV */
export function audioBufferToWav(buf) {
  const numCh = buf.numberOfChannels;
  const sampleRate = buf.sampleRate;
  const length = buf.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const fileSize = 44 + dataSize;

  const ab = new ArrayBuffer(fileSize);
  const view = new DataView(ab);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeAscii(view, 8, 'WAVE');

  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);

  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const channels = [];
  for (let c = 0; c < numCh; c++) channels.push(buf.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = channels[c][i];
      if (s > 1) s = 1; else if (s < -1) s = -1;
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Uint8Array(ab);
}
