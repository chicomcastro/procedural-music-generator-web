// Builds a Markdown summary of the latest Cypress run for the PR sticky
// comment. We list each .png captured under cypress/screenshots and each
// .mp4 under cypress/videos, link to the run's artifact zips (since GitHub
// PR comments can't inline arbitrary images), and surface Cypress's exit
// state.
//
// Inputs (env): RUN_ID, REPO ("owner/repo"), CYPRESS_OUTCOME ("success"|"failure")
// Output: writes the rendered Markdown to $GITHUB_OUTPUT as `body`.
import { readdirSync, statSync, appendFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCREENSHOTS = join(ROOT, 'cypress', 'screenshots');
const VIDEOS = join(ROOT, 'cypress', 'videos');

const repo = process.env.REPO || '';
const runId = process.env.RUN_ID || '';
const outcome = (process.env.CYPRESS_OUTCOME || '').toLowerCase();
const runUrl = repo && runId
  ? `https://github.com/${repo}/actions/runs/${runId}`
  : '';
const screenshotsUrl = runUrl ? `${runUrl}#artifacts` : '';

const screenshots = walk(SCREENSHOTS, '.png');
const videos = walk(VIDEOS, '.mp4');

const statusLine = outcome === 'success'
  ? '✅ All E2E specs passed.'
  : outcome === 'failure'
    ? '❌ One or more E2E specs failed.'
    : '⚠️ E2E run did not produce a clear outcome.';

const body = [
  '## 🎬 E2E Visual Evidence',
  '',
  statusLine,
  '',
  buildSpecBreakdown(screenshots, videos),
  '',
  `**Artifacts** (download from this run): \`cypress-screenshots\` · \`cypress-videos\``,
  screenshotsUrl ? `→ ${screenshotsUrl}` : '',
  '',
  '<sub>One video per spec, plus an end-of-test screenshot for every passing test (captured via cypress/support/e2e.js). Failure screenshots are listed separately when present.</sub>',
].filter(Boolean).join('\n');

setOutput('body', body);

function buildSpecBreakdown(shots, vids) {
  if (shots.length === 0 && vids.length === 0) {
    return '_No screenshots or videos were produced — Cypress probably skipped the run._';
  }
  // Auto-capture (cypress/support/e2e.js) suffixes pass-state shots with
  // "__pass". Anything else is a Cypress-emitted failure snap.
  const passShots = shots.filter(s => s.endsWith('__pass.png'));
  const failShots = shots.filter(s => !s.endsWith('__pass.png'));

  const lines = [];
  if (vids.length) {
    lines.push('**Videos (one per spec):**');
    for (const v of vids) lines.push(`- \`${relative(ROOT, v)}\``);
  }
  if (failShots.length) {
    if (lines.length) lines.push('');
    lines.push('**Failure screenshots:**');
    for (const s of failShots) lines.push(`- \`${relative(ROOT, s)}\``);
  }
  if (passShots.length) {
    lines.push('');
    lines.push(`<details><summary>End-of-test screenshots (${passShots.length})</summary>`);
    lines.push('');
    for (const s of passShots) lines.push(`- \`${relative(ROOT, s)}\``);
    lines.push('');
    lines.push('</details>');
  }
  return lines.join('\n');
}

function walk(dir, ext) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p, ext));
    else if (entry.endsWith(ext)) out.push(p);
  }
  return out.sort();
}

function setOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) {
    console.log(`${name}=\n${value}`);
    return;
  }
  const delimiter = `EOF_${Date.now()}`;
  appendFileSync(file, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}
