#!/usr/bin/env node
// Minimal "build" — copies the static site from src/ into dist/ for deploy.
// The app is vanilla JS modules, no bundling needed; this step exists so CI
// has a single command to produce a deployable artifact.

import { cp, rm, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');

async function main() {
  if (!existsSync(src)) {
    console.error('✗ src/ not found at', src);
    process.exit(1);
  }
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await cp(src, dist, { recursive: true });

  const htmlPath = path.join(dist, 'app.html');
  const stats = await stat(dist);
  if (!stats.isDirectory()) throw new Error('dist not a dir');
  if (!existsSync(htmlPath)) throw new Error('dist/app.html missing');

  console.log(`✓ Built into ${path.relative(root, dist)}/`);
}

main().catch((err) => {
  console.error('✗ Build failed:', err.message);
  process.exit(1);
});
